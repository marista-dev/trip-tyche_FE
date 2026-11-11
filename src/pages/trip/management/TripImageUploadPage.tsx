import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import MiniTicketPreview from '@/domains/media/components/upload/MiniTicketPreview';
import ProcessingStep from '@/domains/media/components/upload/ProcessingStep';
import TripCreateCompleteStep from '@/domains/media/components/upload/TripCreateCompleteStep';
import TripUploadStepper from '@/domains/media/components/upload/TripUploadStepper';
import UploadStep from '@/domains/media/components/upload/UploadStep';
import { useImageUpload } from '@/domains/media/hooks/useImageUpload';
import { useUploadSessionSync } from '@/domains/media/hooks/useUploadSessionSync';
import { ImageUploadStepType } from '@/domains/media/types';
import { getImageDateFromImage } from '@/domains/media/utils';
import TripInfoForm from '@/domains/trip/components/TripInfoForm';
import { FORM } from '@/domains/trip/constants';
import { useTripFormSubmit } from '@/domains/trip/hooks/mutations';
import { useTripFormValidation } from '@/domains/trip/hooks/useTripFormValidation';
import { TripInfo } from '@/domains/trip/types';
import useUserStore from '@/domains/user/stores/useUserStore';
import { ANALYTICS_EVENTS, track } from '@/libs/analytics';
import { mediaAPI, tripAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import { pickImagesFromGallery } from '@/platform/native/gallery';
import Button from '@/shared/components/common/Button';
import Header from '@/shared/components/common/Header';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';
import { MESSAGE } from '@/shared/constants/ui';
import { useAppDownloadUrl } from '@/shared/hooks/useAppDownloadUrl';
import useBrowserCheck from '@/shared/hooks/useBrowserCheck';

const stepIndex = (step: ImageUploadStepType): 0 | 1 | 2 => {
    if (step === 'info') return 1;
    if (step === 'done') return 2;
    return 0;
};

const TripImageUploadPage = () => {
    const [step, setStep] = useState<ImageUploadStepType>('upload');
    const [tripForm, setTripForm] = useState<TripInfo>(FORM.INITIAL);
    const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | undefined>();

    const { isModalOpen, closeModal } = useBrowserCheck();
    const downloadUrl = useAppDownloadUrl(isModalOpen);

    const { isFormComplete } = useTripFormValidation(tripForm);
    const { images, progress, prepareUploadFiles, uploadImagesToS3, retryFailedUploads, waitForBackgroundUpload } =
        useImageUpload();

    const userInfo = useUserStore((state) => state.userInfo);

    const { mutateAsync } = useTripFormSubmit();

    // 사용자가 '여행 등록하기'를 누른 순간의 tripForm을 lock.
    // step3 phase0에서 handleUpdateForm이 이 ref를 사용해 PUT 호출 → retry 시에도 같은 값 사용.
    const submittedTripFormRef = useRef<TripInfo | null>(null);

    // photos_uploaded 퍼널 이벤트용. 이 페이지는 usePhotoUpload를 거치지 않아 여기서 직접 센다.
    const uploadBatchSizeRef = useRef(0);
    const photosTrackedRef = useRef(false);

    const { tripKey } = useParams();
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const isEdit = pathname.includes('edit');

    useUploadSessionSync(tripKey ?? null, userInfo?.userId ?? null);

    // 추출된 이미지 → tripForm의 mediaFilesDates 동기화 (날짜 픽커 인디케이터에 사용).
    useEffect(() => {
        const imageDates = getImageDateFromImage(images || null);
        /*
         * 사진 날짜만 갱신하고 입력값은 건드리지 않는다. images는 업로드 진행 중에도 다시 설정되는데,
         * 예전엔 그때마다 폼 전체를 초기화해 사진 위치로 자동 선택한 여행지나 사용자가 쓴 제목이 지워졌다.
         */
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
        // 장수만 보낸다. 파일명·tripKey는 식별 정보라 속성에 넣지 않는다.
        track(ANALYTICS_EVENTS.PHOTOS_UPLOADED, { count: uploadBatchSizeRef.current });
    }, [waitForBackgroundUpload]);

    const handleFinalize = useMemo(
        () => async () => {
            if (!tripKey) return { success: false, error: 'tripKey가 없습니다.' };
            return await toResult(() => tripAPI.finalizeTripTicket(tripKey));
        },
        [tripKey],
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
        const selectedImages = event.target.files;
        if (!selectedImages || selectedImages.length === 0) return;

        await processSelectedImages(Array.from(selectedImages));
    };

    // 네이티브 갤러리 피커 — EXIF 원본을 보존해서 File[]로 돌려준다.
    const handleNativePick = async () => {
        const pickedImages = await pickImagesFromGallery();
        if (pickedImages.length === 0) return;

        await processSelectedImages(pickedImages);
    };

    const processSelectedImages = async (selectedImages: File[]) => {
        setStep('processing');
        const uniqueFiles = await prepareUploadFiles(selectedImages);
        uploadBatchSizeRef.current = uniqueFiles.length;
        // S3 업로드는 백그라운드로 진행되며, 정보 입력 화면 진입을 막지 않는다.
        // 실제 업로드 완료는 Step3에서 waitForBackgroundUpload로 추적된다.
        // 신규 등록일 때는 status 전환도 같은 체인에 묶어 실패 시 step3 retry 화면에 surface되도록 한다.
        const postUploadTask = !isEdit ? () => mediaAPI.updateTripStatusToImagesUploaded(tripKey!) : undefined;
        await uploadImagesToS3(uniqueFiles, postUploadTask);
        setStep('info');
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
                                sample
                            />
                            <p css={previewHint}>↓ 아래를 편집하면 티켓이 실시간으로 바뀌어요</p>
                        </div>
                        <TripInfoForm
                            tripForm={tripForm}
                            onChangeTripInfo={setTripForm}
                            photoLocations={images ?? undefined}
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
            <main css={mainStyle}>{renderMainSection()}</main>

            {isModalOpen && (
                <ConfirmModal
                    title='사진 위치가 지워질 수 있어요'
                    description={
                        '안드로이드 브라우저는 사진을 올릴 때 위치 정보를 제거해요.\n' +
                        '앱으로 올리면 사진에 담긴 위치가 그대로 지도에 표시됩니다.'
                    }
                    confirmText='앱 설치하기'
                    cancelText='웹으로 계속하기'
                    confirmModal={() => {
                        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                        closeModal();
                    }}
                    closeModal={closeModal}
                />
            )}
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

const buttonWrapper = css`
    margin-top: 20px;
`;

export default TripImageUploadPage;
