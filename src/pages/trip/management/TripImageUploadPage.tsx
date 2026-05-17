import { useEffect, useMemo, useState } from 'react';

import { css } from '@emotion/react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import MiniTicketPreview from '@/domains/media/components/upload/MiniTicketPreview';
import ProcessingStep from '@/domains/media/components/upload/ProcessingStep';
import TripCreateCompleteStep from '@/domains/media/components/upload/TripCreateCompleteStep';
import TripUploadStepper from '@/domains/media/components/upload/TripUploadStepper';
import UploadStep from '@/domains/media/components/upload/UploadStep';
import { useImageUpload } from '@/domains/media/hooks/useImageUpload';
import { ImageUploadStepType } from '@/domains/media/types';
import { getImageDateFromImage } from '@/domains/media/utils';
import TripInfoForm from '@/domains/trip/components/TripInfoForm';
import { FORM } from '@/domains/trip/constants';
import { useTripFormSubmit } from '@/domains/trip/hooks/mutations';
import { useTripFormValidation } from '@/domains/trip/hooks/useTripFormValidation';
import { TripInfo } from '@/domains/trip/types';
import useUserStore from '@/domains/user/stores/useUserStore';
import { mediaAPI, tripAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import Button from '@/shared/components/common/Button';
import Header from '@/shared/components/common/Header';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';
import { MESSAGE } from '@/shared/constants/ui';
import useBrowserCheck from '@/shared/hooks/useBrowserCheck';
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

    const { isModalOpen, closeModal } = useBrowserCheck();

    const { isFormComplete } = useTripFormValidation(tripForm);
    const {
        images,
        progress,
        uploadStats,
        extractMetaData,
        uploadImagesToS3,
        retryFailedUploads,
        waitForBackgroundUpload,
    } = useImageUpload();

    const showToast = useToastStore((state) => state.showToast);
    const userInfo = useUserStore((state) => state.userInfo);

    const { mutateAsync, isPending: isSubmitting } = useTripFormSubmit();

    const { tripKey } = useParams();
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const isEdit = pathname.includes('edit');

    // 추출된 이미지 → tripForm의 mediaFilesDates 동기화 (날짜 픽커 인디케이터에 사용).
    useEffect(() => {
        const imageDates = getImageDateFromImage(images || null);
        setTripForm({
            tripTitle: '',
            country: '',
            startDate: '',
            endDate: '',
            hashtags: [],
            mediaFilesDates: imageDates ?? [],
        });
    }, [images]);

    // 첫 사진을 cover로 사용. images 변경 시 이전 URL 해제 + unmount 시 정리.
    useEffect(() => {
        if (!images || images.length === 0) return;
        const url = URL.createObjectURL(images[0].image);
        setCoverPhotoUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [images]);

    const handleFinalize = useMemo(
        () => async () => {
            if (!tripKey) return { success: false, error: 'tripKey가 없습니다.' };
            return await toResult(() => tripAPI.finalizeTripTicket(tripKey));
        },
        [tripKey],
    );

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedImages = event.target.files;
        if (!selectedImages || selectedImages.length === 0) return;

        setStep('processing');
        const uniqueFiles = await extractMetaData(selectedImages);
        // S3 업로드는 백그라운드로 진행되며, 정보 입력 화면 진입을 막지 않는다.
        // 실제 업로드 완료는 Step3에서 waitForBackgroundUpload로 추적된다.
        // 신규 등록일 때는 status 전환도 같은 체인에 묶어 실패 시 step3 retry 화면에 surface되도록 한다.
        const postUploadTask = !isEdit ? () => mediaAPI.updateTripStatusToImagesUploaded(tripKey!) : undefined;
        await uploadImagesToS3(uniqueFiles, postUploadTask);
        setStep('info');
    };

    const handleTripFormSubmit = async () => {
        if (!tripKey) return;

        try {
            const result = await mutateAsync({ tripKey, tripForm });
            if (result.success) {
                // Step3에서 waitForBackgroundUpload + finalize를 순차 처리한다.
                setStep('done');
            } else {
                showToast(result.error);
            }
        } catch {
            // toResult가 정상 동작하면 여기까지 오지 않지만, 다른 경로(react-query 내부 throw 등) 안전망.
            showToast(MESSAGE.ERROR.UNKNOWN);
        }
    };

    const isCreateDone = step === 'done';

    const renderMainSection = () => {
        switch (step) {
            case 'upload':
                return <UploadStep onImageSelect={handleImageUpload} />;
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
                        <TripInfoForm tripForm={tripForm} onChangeTripInfo={setTripForm} />
                        <div css={buttonWrapper}>
                            <Button text='여행 등록하기' onClick={handleTripFormSubmit} disabled={!isFormComplete} />
                        </div>
                    </div>
                );
            case 'done':
                return (
                    <TripCreateCompleteStep
                        tripInfo={tripForm}
                        waitForBackgroundUpload={waitForBackgroundUpload}
                        onFinalize={handleFinalize}
                        coverPhotoUrl={coverPhotoUrl}
                        ownerNickname={userInfo?.nickname}
                        photoCount={images?.length}
                        uploadStats={uploadStats}
                        onRetryUpload={retryFailedUploads}
                    />
                );
        }
    };

    return (
        <div css={page}>
            {isSubmitting && <Indicator text='잠시만 기다려 주세요…' />}
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
                    title='더 나은 경험을 위한 안내'
                    description='안드로이드 환경에서는 사진 업로드가 제한될 수 있어요. 데스크탑으로 접속해주세요!'
                    confirmText='알겠어요'
                    cancelText='계속 진행할래요'
                    confirmModal={() => {
                        closeModal();
                        navigate(-1);
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
