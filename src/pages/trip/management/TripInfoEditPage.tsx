import { useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import MiniTicketPreview from '@/domains/media/components/upload/MiniTicketPreview';
import TripInfoForm from '@/domains/trip/components/TripInfoForm';
import { FORM } from '@/domains/trip/constants';
import { useTripFormSubmit } from '@/domains/trip/hooks/mutations';
import { useTripInfo } from '@/domains/trip/hooks/queries';
import { useTripFormValidation } from '@/domains/trip/hooks/useTripFormValidation';
import { TripInfo } from '@/domains/trip/types';
import useUserStore from '@/domains/user/stores/useUserStore';
import { tripAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import Button from '@/shared/components/common/Button';
import Header from '@/shared/components/common/Header';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';
import { useToastStore } from '@/shared/stores/useToastStore';

const TripInfoEditPage = () => {
    const [tripForm, setTripForm] = useState<TripInfo>(FORM.INITIAL);
    const [isTripFinalizing, setIsTripFinalizing] = useState(false);
    const showToast = useToastStore((state) => state.showToast);
    const userInfo = useUserStore((state) => state.userInfo);

    const { tripKey } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const {
        state: { isDraft },
    } = location;

    const queryClient = useQueryClient();
    const { mutateAsync, isPending: isSubmitting } = useTripFormSubmit();

    const { data: tripInfoResult, isLoading } = useTripInfo(tripKey!);
    const { isFormComplete } = useTripFormValidation(tripForm);

    useEffect(() => {
        if (tripInfoResult) {
            if (!tripInfoResult.success) {
                showToast(tripInfoResult?.error);
                navigate(ROUTES.PATH.TICKETS);
                return;
            }
            setTripForm((prev) => {
                if (isDraft) {
                    const mediaFileDates = tripInfoResult.data.mediaFilesDates || [];
                    const validMediaFileDates = mediaFileDates.filter((mediaFile) => mediaFile !== '1980-01-01');
                    return {
                        ...prev,
                        mediaFilesDates: validMediaFileDates,
                    };
                }
                return tripInfoResult.data;
            });
        }
    }, [tripInfoResult, isDraft]);

    const finalizeTrip = async () => {
        if (!tripKey) return;

        const result = await toResult(() => tripAPI.finalizeTripTicket(tripKey));
        if (result && !result.success) {
            showToast(result.error);
        }
    };

    const handleTripFormSubmit = async () => {
        if (!tripKey) return;

        const result = await mutateAsync({ tripKey, tripForm });
        if (result.success) {
            queryClient.invalidateQueries({ queryKey: ['ticket-info', tripKey] });
            if (isDraft) {
                setIsTripFinalizing(true);
                await finalizeTrip();
                setIsTripFinalizing(false);
            }
        }
        showToast(result.success ? result.data : result.error);
        navigate(ROUTES.PATH.TICKETS);
    };

    return (
        <div css={pageContainer}>
            {(isLoading || isSubmitting || isTripFinalizing) && <Indicator text='여행 정보 불러오는 중...' />}

            <Header
                title={ROUTES.PATH_TITLE.TRIPS.NEW.INFO}
                isBackButton
                onBack={() => navigate(ROUTES.PATH.TICKETS)}
            />
            <main css={mainStyle}>
                <div css={previewWrapper}>
                    <MiniTicketPreview trip={tripForm} ownerNickname={userInfo?.nickname} />
                    <p css={previewHint}>↓ 아래를 편집하면 티켓이 실시간으로 바뀌어요</p>
                </div>
                <TripInfoForm isEditing={true} tripForm={tripForm} onChangeTripInfo={setTripForm} />
                <div css={buttonWrapper}>
                    <Button
                        text={`여행 ${isDraft ? '등록' : '수정'}하기`}
                        onClick={handleTripFormSubmit}
                        disabled={!isFormComplete}
                    />
                </div>
            </main>
        </div>
    );
};

const pageContainer = css`
    height: 100dvh;
    display: flex;
    flex-direction: column;
`;

const mainStyle = css`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 16px;
    overflow-y: auto;
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
    margin-top: 4px;
`;

export default TripInfoEditPage;
