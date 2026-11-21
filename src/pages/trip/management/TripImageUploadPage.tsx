import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import MiniTicketPreview from '@/domains/media/components/upload/MiniTicketPreview';
import ProcessingStep from '@/domains/media/components/upload/ProcessingStep';
import TripCreateCompleteStep from '@/domains/media/components/upload/TripCreateCompleteStep';
import TripUploadStepper from '@/domains/media/components/upload/TripUploadStepper';
import UploadLeaveConfirm from '@/domains/media/components/upload/UploadLeaveConfirm';
import UploadStep from '@/domains/media/components/upload/UploadStep';
import { useImageUpload } from '@/domains/media/hooks/useImageUpload';
import { isUploadInProgress, UPLOAD_GUARD_TEXT, useUploadGuard } from '@/domains/media/hooks/useUploadGuard';
import { useUploadSessionSync } from '@/domains/media/hooks/useUploadSessionSync';
import { invalidateTripMedia } from '@/domains/media/queryKeys';
import { ImageUploadStepType } from '@/domains/media/types';
import { getImageDateFromImage } from '@/domains/media/utils';
import { describeDuplicates, describeWithoutLocation } from '@/domains/media/utils/uploadMessages';
import type { PickerReport } from '@/domains/media/utils/uploadValidation';
import TripInfoForm from '@/domains/trip/components/TripInfoForm';
import { FORM } from '@/domains/trip/constants';
import { useTripFormSubmit } from '@/domains/trip/hooks/mutations';
import { TripInfo } from '@/domains/trip/types';
import useUserStore from '@/domains/user/stores/useUserStore';
import { ANALYTICS_EVENTS, track } from '@/libs/analytics';
import { mediaAPI, tripAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import { summarizeUploadFormats } from '@/libs/utils/image';
import { validateFormComplete } from '@/libs/utils/validate';
import { isIOSWeb } from '@/platform';
import { pickImagesFromGallery } from '@/platform/native/gallery';
import Button from '@/shared/components/common/Button';
import Header from '@/shared/components/common/Header';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';
import { MESSAGE } from '@/shared/constants/ui';
import { useToastStore } from '@/shared/stores/useToastStore';

const stepIndex = (step: ImageUploadStepType): 0 | 1 | 2 => {
    if (step === 'info') return 1;
    if (step === 'done') return 2;
    return 0;
};

const TripImageUploadPage = () => {
    const [step, setStep] = useState<ImageUploadStepType>('upload');
    const [tripForm, setTripForm] = useState<TripInfo>(FORM.INITIAL);
    const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | undefined>();
    const [isDayTrip, setIsDayTrip] = useState(false);

    const isFormComplete = validateFormComplete(tripForm);
    const {
        images,
        imageCategories,
        progress,
        uploadStats,
        uploadPhase,
        duplicateCount,
        prepareUploadFiles,
        uploadImagesToS3,
        retryFailedUploads,
        uploadDuplicates,
        waitForBackgroundUpload,
    } = useImageUpload({ source: 'create' });
    // 정보 입력 중에도 전송은 백그라운드로 돈다. 그동안 화면을 떠나면 남은 사진을 잃는다.
    const isTransferring = isUploadInProgress(uploadPhase);
    const uploadGuard = useUploadGuard(isTransferring);
    // 제외 안내 토스트와 겹치지 않게 정보 입력 화면에 글로 남긴다
    const withoutLocationNotice = describeWithoutLocation(imageCategories?.withoutLocation.count ?? 0);
    // 서버가 이 여행에 이미 있다고 알려 와 빼 둔 사진. 누르면 지금 업로드가 끝난 뒤 그 사진만 올린다.
    const duplicateNotice = describeDuplicates(duplicateCount);
    const queryClient = useQueryClient();

    const userInfo = useUserStore((state) => state.userInfo);

    const { mutateAsync } = useTripFormSubmit();

    // 사용자가 '여행 등록하기'를 누른 순간의 tripForm을 lock.
    // step3 phase0에서 handleUpdateForm이 이 ref를 사용해 PUT 호출 → retry 시에도 같은 값 사용.
    const submittedTripFormRef = useRef<TripInfo | null>(null);

    // photos_uploaded 퍼널 이벤트용. 이 페이지는 usePhotoUpload를 거치지 않아 여기서 직접 센다.
    const uploadSummaryRef = useRef<ReturnType<typeof summarizeUploadFormats> | null>(null);
    const photosTrackedRef = useRef(false);

    const { tripKey } = useParams();
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const isEdit = pathname.includes('edit');

    useUploadSessionSync(tripKey ?? null, userInfo?.userId ?? null);

    // 추출된 이미지 → tripForm의 mediaFilesDates 동기화 (날짜 픽커 인디케이터에 사용).
    useEffect(() => {
        const imageDates = getImageDateFromImage(images || null);
        // images는 업로드 중에도 다시 설정된다 — 사진 날짜만 갱신하고 입력값은 둔다.
        setTripForm((prev) => ({ ...prev, mediaFilesDates: imageDates ?? [] }));
    }, [images]);

    // 첫 사진을 cover로 사용. images 변경 시 이전 URL 해제 + unmount 시 정리.
    useEffect(() => {
        if (!images || images.length === 0) return;
        const url = URL.createObjectURL(images[0].image);
        setCoverPhotoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [images]);

    // Step3가 await하는 업로드 완료 시점(S3 + 메타등록 + status 전환까지 성공)에만 센다.
    // 실패하면 throw되어 여기까지 오지 않고, retry나 StrictMode 재실행으로 다시 불려도 ref로 1회만 보낸다.
    // 함수 identity가 바뀌면 Step3의 runPhases useEffect가 재발화하므로 deps는 안정적인 값만 둔다.
    const waitForUploadAndTrack = useCallback(async () => {
        await waitForBackgroundUpload();
        if (photosTrackedRef.current) return;
        photosTrackedRef.current = true;
        // 장수·형식·용량만 보낸다. 파일명·tripKey는 식별 정보라 속성에 넣지 않는다.
        track(ANALYTICS_EVENTS.PHOTOS_UPLOADED, { ...uploadSummaryRef.current, ios_web: isIOSWeb() });
    }, [waitForBackgroundUpload]);

    const handleFinalize = useMemo(
        () => async () => {
            if (!tripKey) return { success: false, error: 'tripKey가 없습니다.' };
            const result = await toResult(() => tripAPI.finalizeTripTicket(tripKey));
            if (result.success) {
                // 발급된 티켓이 지구본(장수·커버)·티켓 목록·지도 핀에 바로 보이게
                void invalidateTripMedia(queryClient, tripKey);
            }
            return result;
        },
        [tripKey, queryClient],
    );

    // step3 phase0에서 호출. 매 호출마다 mutateAsync를 새로 발사 → retry 시 자동으로 재시도된다.
    // PUT은 idempotent하므로 중복 호출이 안전.
    const handleUpdateForm = useCallback(async () => {
        if (!tripKey || !submittedTripFormRef.current) {
            return { success: false, error: 'tripKey가 없습니다.' };
        }
        try {
            return await mutateAsync({ tripKey, tripForm: submittedTripFormRef.current });
        } catch {
            return { success: false, error: MESSAGE.ERROR.UNKNOWN };
        }
    }, [mutateAsync, tripKey]);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputEl = event.target;
        const selectedImages = inputEl.files;
        if (!selectedImages || selectedImages.length === 0) return;

        const accepted = await processSelectedImages(Array.from(selectedImages));
        // 전부 제외됐으면 첫 화면에 남는다. 같은 파일을 다시 골라도 onChange가 오도록 비운다(올릴 파일이 없어 안전하다).
        if (!accepted) inputEl.value = '';
    };

    // 네이티브 갤러리 피커 — EXIF 원본을 보존해서 File[]로 돌려준다.
    const handleNativePick = async () => {
        // 영상만 고른 경우도 prepareUploadFiles가 안내한다. 아무 반응이 없으면 앱이 멈춘 것처럼 보인다.
        const { files, skippedNonImage, locationNotice } = await pickImagesFromGallery();
        await processSelectedImages(files, { skippedNonImage, notice: locationNotice });
    };

    const processSelectedImages = async (selectedImages: File[], pick?: PickerReport) => {
        const uniqueFiles = await prepareUploadFiles(selectedImages, pick);
        // 제외 안내는 prepareUploadFiles가 이미 띄웠다. 다시 고를 수 있게 첫 화면에 둔다.
        if (uniqueFiles.length === 0) return false;
        setStep('processing');
        const summary = summarizeUploadFormats(uniqueFiles);
        // S3 업로드는 백그라운드로 진행되며, 정보 입력 화면 진입을 막지 않는다.
        // 실제 업로드 완료는 Step3에서 waitForBackgroundUpload로 추적된다.
        // 신규 등록일 때는 status 전환도 같은 체인에 묶어 실패 시 step3 retry 화면에 surface되도록 한다.
        const postUploadTask = !isEdit ? () => mediaAPI.updateTripStatusToImagesUploaded(tripKey!) : undefined;
        const { started } = await uploadImagesToS3(uniqueFiles, postUploadTask);
        // 업로드가 실제로 시작된 배치만 기록한다(진행 중이면 위에서 던져 이전 배치의 집계를 덮어쓰지 않는다)
        uploadSummaryRef.current = summary;
        // 정보 입력은 계속할 수 있다. 마지막 단계의 재시도가 URL 발급부터 다시 한다.
        if (!started)
            useToastStore.getState().showToast('업로드 준비에 실패했어요. 마지막 단계에서 다시 시도할 수 있어요');
        setStep('info');
        return true;
    };

    const handleTripFormSubmit = () => {
        if (!tripKey) return;
        // 백엔드 PUT은 step3 phase0에서 handleUpdateForm으로 await됨.
        // 여기선 즉시 전환 → 사용자는 업로드 진행률을 바로 보고, 실패 시 step3 retry 버튼 활용.
        submittedTripFormRef.current = tripForm;
        setStep('done');
    };

    const isCreateDone = step === 'done';

    const renderMainSection = () => {
        switch (step) {
            case 'upload':
                return <UploadStep onImageSelect={handleImageUpload} onNativePick={handleNativePick} />;
            case 'processing':
                return <ProcessingStep progress={progress} />;
            case 'review':
                return null;
            case 'info':
                return (
                    <div css={infoSectionContainer}>
                        <div css={previewWrapper}>
                            <MiniTicketPreview
                                trip={tripForm}
                                ownerNickname={userInfo?.nickname}
                                coverPhotoUrl={coverPhotoUrl}
                                photoCount={images?.length}
                                isSample
                                isDayTrip={isDayTrip}
                            />
                            <p css={previewHint}>↓ 아래를 편집하면 티켓이 실시간으로 바뀌어요</p>
                            {withoutLocationNotice && <p css={locationNoticeStyle}>{withoutLocationNotice}</p>}
                            {duplicateNotice && (
                                <p css={locationNoticeStyle}>
                                    {duplicateNotice} ·{' '}
                                    <button type='button' css={noticeActionStyle} onClick={uploadDuplicates}>
                                        그래도 올리기
                                    </button>
                                </p>
                            )}
                        </div>
                        <TripInfoForm
                            tripForm={tripForm}
                            onChangeTripInfo={setTripForm}
                            photoLocations={images ?? undefined}
                            onDayTripChange={setIsDayTrip}
                        />
                        <div css={buttonWrapper}>
                            <Button text='여행 등록하기' onClick={handleTripFormSubmit} disabled={!isFormComplete} />
                        </div>
                    </div>
                );
            case 'done':
                return (
                    <TripCreateCompleteStep
                        tripInfo={tripForm}
                        waitForBackgroundUpload={waitForUploadAndTrack}
                        onUpdateForm={handleUpdateForm}
                        onFinalize={handleFinalize}
                        coverPhotoUrl={coverPhotoUrl}
                        ownerNickname={userInfo?.nickname}
                        photoCount={images?.length}
                        onRetryUpload={retryFailedUploads}
                        uploadPhase={uploadPhase}
                        uploadStats={uploadStats}
                    />
                );
        }
    };

    return (
        <div css={page}>
            <Header
                title={`새로운 ${isEdit ? '사진' : '여행'} 등록`}
                isBackButton
                onBack={() =>
                    isEdit ? navigate(ROUTES.PATH.TRIP.EDIT.IMAGE(tripKey!)) : navigate(ROUTES.PATH.TICKETS)
                }
            />

            {!isCreateDone && (
                <div css={stepperWrapper}>
                    <TripUploadStepper step={stepIndex(step)} />
                </div>
            )}
            {/* 처리 단계는 자체 안내('화면을 나가지 마세요')가 있다 */}
            {isTransferring && step !== 'processing' && <p css={uploadHintStyle}>{UPLOAD_GUARD_TEXT.hint}</p>}
            <main css={mainStyle}>{renderMainSection()}</main>

            <UploadLeaveConfirm guard={uploadGuard} />
        </div>
    );
};

const page = css`
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: ${COLORS.BACKGROUND.PRIMARY};
`;

const stepperWrapper = css`
    padding: 20px 0;
    background: #fff;
`;

const mainStyle = css`
    flex: 1;
    height: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
`;

const infoSectionContainer = css`
    display: flex;
    flex-direction: column;
    gap: 18px;
`;

const previewWrapper = css`
    display: flex;
    flex-direction: column;
`;

const previewHint = css`
    text-align: center;
    margin-top: 10px;
    font-size: 10px;
    color: #94a3b8;
    font-weight: 600;
`;

const locationNoticeStyle = css`
    text-align: center;
    margin-top: 4px;
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
`;

const noticeActionStyle = css`
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    color: ${COLORS.TEXT.LINK_LIGHT};
    text-decoration: underline;
    cursor: pointer;
`;

const uploadHintStyle = css`
    padding: 8px 16px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: ${COLORS.TEXT.SECONDARY};
    background: #fff;
`;

const buttonWrapper = css`
    margin-top: 20px;
    /* 안드로이드 제스처 바에 버튼이 가리지 않게 */
    padding-bottom: var(--app-safe-bottom);
`;

export default TripImageUploadPage;
