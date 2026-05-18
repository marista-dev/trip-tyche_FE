import { useCallback, useEffect, useMemo, useState } from 'react';

import { css } from '@emotion/react';
import { MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import EstimateTargetTab from '@/domains/media/components/manage/EstimateTargetTab';
import ManageHeader from '@/domains/media/components/manage/ManageHeader';
import ReferencePhotoCard from '@/domains/media/components/manage/ReferencePhotoCard';
import StickyApplyCTA from '@/domains/media/components/manage/StickyApplyCTA';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMetadataUpdate } from '@/domains/media/hooks/mutations';
import { useTripImages } from '@/domains/media/hooks/queries';
import { useEstimateStore } from '@/domains/media/stores/useEstimateStore';
import { MediaFile } from '@/domains/media/types';
import { extractTimeOfDay, findNearbyPhotosByLocation, formatDistance } from '@/domains/media/utils';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';
import { useReverseGeocode } from '@/shared/hooks/useReverseGeocode';
import { useToastStore } from '@/shared/stores/useToastStore';

const formatDateLabel = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
};

const LocationBasedEstimatePage = () => {
    const { tripKey = '' } = useParams<{ tripKey: string }>();
    const navigate = useNavigate();
    const { showToast } = useToastStore();
    const { mode, tripKey: storeTripKey, targets, clear } = useEstimateStore();

    const { data: imagesResult, isLoading } = useTripImages(tripKey);
    const { mutate: updateMutate, isPending: isApplying } = useMetadataUpdate();

    const pool: MediaFile[] = useMemo(
        () => (imagesResult?.success ? (imagesResult.data as MediaFile[]) : []),
        [imagesResult],
    );

    useEffect(() => {
        if (!isLoading && (targets.length === 0 || mode !== 'location' || storeTripKey !== tripKey)) {
            showToast('처리할 사진을 다시 선택해주세요');
            navigate(ROUTES.PATH.TRIP.EDIT.NO_DATE(tripKey), { replace: true });
        }
    }, [isLoading, mode, storeTripKey, tripKey, targets.length, navigate, showToast]);

    const [activeId, setActiveId] = useState<number | null>(null);
    const [picks, setPicks] = useState<Record<number, number>>({});

    useEffect(() => {
        if (activeId === null && targets.length > 0) setActiveId(targets[0].mediaFileId);
    }, [targets, activeId]);

    const activeTarget = targets.find((t) => t.mediaFileId === activeId) || null;

    // 활성 target의 좌표 → 주소
    const { address: activeAddress } = useReverseGeocode(activeTarget?.latitude ?? 0, activeTarget?.longitude ?? 0);

    const nearby = useMemo(() => {
        if (!activeTarget) return [];
        return findNearbyPhotosByLocation(activeTarget, pool);
    }, [activeTarget, pool]);

    const totalApplied = Object.keys(picks).length;

    const skipActive = useCallback(() => {
        if (targets.length <= 1) {
            navigate(-1);
            return;
        }
        const currentIdx = targets.findIndex((t) => t.mediaFileId === activeId);
        const rotated = [...targets.slice(currentIdx + 1), ...targets.slice(0, currentIdx)];
        const next = rotated.find((t) => picks[t.mediaFileId] === undefined);
        if (next) setActiveId(next.mediaFileId);
        else navigate(-1);
    }, [targets, activeId, picks, navigate]);

    const handleApply = () => {
        const updated: MediaFile[] = targets
            .filter((t) => picks[t.mediaFileId] !== undefined)
            .map((t) => {
                const ref = pool.find((p) => p.mediaFileId === picks[t.mediaFileId]);
                if (!ref) return t;
                return { ...t, recordDate: ref.recordDate };
            });

        if (updated.length === 0) return;

        updateMutate(
            { tripKey, images: updated },
            {
                onSuccess: (result) => {
                    if (result.success) {
                        showToast(`${updated.length}장의 날짜가 업데이트되었어요`);
                        clear();
                        navigate(-1);
                    } else {
                        showToast(result.error);
                    }
                },
            },
        );
    };

    if (isLoading) return <Indicator />;
    if (!activeTarget) return <Indicator />;

    return (
        <div css={containerStyle}>
            {isApplying && <Indicator text='적용 중...' />}

            <ManageHeader
                title='가까운 위치 사진 찾기'
                subtitle='같은 날일 가능성이 있는 사진을 골라주세요'
                onBack={() => navigate(-1)}
            />

            <div css={targetsSectionStyle}>
                <div css={targetsLabelStyle}>처리할 사진 · {targets.length}장</div>
                <div css={targetsRowStyle}>
                    {targets.map((t) => (
                        <EstimateTargetTab
                            key={t.mediaFileId}
                            photo={t}
                            active={t.mediaFileId === activeId}
                            done={!!picks[t.mediaFileId]}
                            showTime={false}
                            onClick={() => setActiveId(t.mediaFileId)}
                        />
                    ))}
                </div>
            </div>

            <div css={activeContextStyle}>
                <div css={activeThumbStyle}>
                    <img src={activeTarget.mediaLink} alt='' css={activeImgStyle} loading='lazy' />
                </div>
                <div css={activeInfoStyle}>
                    <p css={activePrimaryStyle}>
                        <MapPin size={12} strokeWidth={2.4} color={MANAGE_TOKENS.accent} />
                        {activeAddress || '위치 확인 중...'}
                    </p>
                    <p css={activeSubStyle}>주변 500m 범위 내 날짜 있는 사진을 찾았어요</p>
                </div>
            </div>

            <main css={listStyle}>
                {nearby.length === 0 ? (
                    <div css={emptyCardStyle}>
                        <div css={emptyIconStyle}>
                            <MapPin size={28} strokeWidth={2.2} color={MANAGE_TOKENS.text.muted} />
                        </div>
                        <h4 css={emptyTitleStyle}>가까운 위치의 사진이 없어요</h4>
                        <p css={emptyDescStyle}>직접 날짜를 입력해주세요</p>
                        <div css={emptyActionsStyle}>
                            <button
                                type='button'
                                css={emptyPrimaryStyle}
                                onClick={() => {
                                    clear();
                                    navigate(ROUTES.PATH.TRIP.EDIT.NO_DATE(tripKey));
                                }}
                            >
                                날짜 직접 입력
                            </button>
                            <button type='button' css={emptySecondaryStyle} onClick={skipActive}>
                                건너뛰기
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h3 css={listLabelStyle}>같은 날일 가능성이 있는 사진</h3>
                        <div css={cardsStyle}>
                            {nearby.map((ref) => {
                                const isPicked = picks[activeTarget.mediaFileId] === ref.mediaFileId;
                                return (
                                    <ReferencePhotoCard
                                        key={ref.mediaFileId}
                                        mediaLink={ref.mediaLink}
                                        primaryLabel={formatDateLabel(ref.recordDate)}
                                        secondaryLabel={extractTimeOfDay(ref.recordDate)}
                                        metaLabel={`${formatDistance(ref.distM)} 거리`}
                                        metaIcon='location'
                                        selected={isPicked}
                                        onClick={() =>
                                            setPicks((p) => {
                                                const next = { ...p };
                                                if (isPicked) delete next[activeTarget.mediaFileId];
                                                else next[activeTarget.mediaFileId] = ref.mediaFileId;
                                                return next;
                                            })
                                        }
                                    />
                                );
                            })}
                        </div>
                        <div css={skipRowStyle}>
                            <button type='button' css={skipButtonStyle} onClick={skipActive}>
                                이 사진 건너뛰기
                            </button>
                        </div>
                        <p css={hintStyle}>가까운 거리의 사진을 골라 같은 날짜로 표시할 수 있어요.</p>
                    </>
                )}
            </main>

            <StickyApplyCTA
                label={totalApplied === 0 ? '사진을 선택해주세요' : `${totalApplied}장 적용하기`}
                disabled={totalApplied === 0}
                isLoading={isApplying}
                onClick={handleApply}
            />
        </div>
    );
};

const containerStyle = css`
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: ${MANAGE_TOKENS.bg};
    color: ${MANAGE_TOKENS.text.primary};
    font-family: ${MANAGE_TOKENS.font};
`;

const targetsSectionStyle = css`
    padding: 12px 16px;
    background: ${MANAGE_TOKENS.card};
    border-bottom: 1px solid ${MANAGE_TOKENS.border};
`;

const targetsLabelStyle = css`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    color: ${MANAGE_TOKENS.text.muted};
    text-transform: uppercase;
    margin-bottom: 8px;
`;

const targetsRowStyle = css`
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
        display: none;
    }
`;

const activeContextStyle = css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px 12px;
    background: ${MANAGE_TOKENS.card};
    border-bottom: 1px solid ${MANAGE_TOKENS.border};
`;

const activeThumbStyle = css`
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    background: ${MANAGE_TOKENS.bg};
`;

const activeImgStyle = css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
`;

const activeInfoStyle = css`
    flex: 1;
    min-width: 0;
`;

const activePrimaryStyle = css`
    margin: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: ${MANAGE_TOKENS.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const activeSubStyle = css`
    margin: 2px 0 0;
    font-size: 11px;
    color: ${MANAGE_TOKENS.text.muted};
`;

const listStyle = css`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 12px 16px 140px;
`;

const listLabelStyle = css`
    margin: 0 4px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    color: ${MANAGE_TOKENS.text.label};
    text-transform: uppercase;
`;

const cardsStyle = css`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const skipRowStyle = css`
    display: flex;
    justify-content: center;
    margin-top: 14px;
`;

const skipButtonStyle = css`
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: transparent;
    color: ${MANAGE_TOKENS.text.label};
    font-family: ${MANAGE_TOKENS.font};
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    &:active {
        background: rgba(0, 0, 0, 0.04);
    }
`;

const hintStyle = css`
    margin: 14px 8px 0;
    font-size: 11px;
    line-height: 1.5;
    color: #999;
    text-align: center;
`;

const emptyCardStyle = css`
    background: ${MANAGE_TOKENS.card};
    border-radius: 14px;
    padding: 40px 20px;
    text-align: center;
    border: 1px dashed rgba(0, 0, 0, 0.12);
`;

const emptyIconStyle = css`
    margin-bottom: 10px;
    display: grid;
    place-items: center;
`;

const emptyTitleStyle = css`
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 700;
    color: ${MANAGE_TOKENS.text.primary};
`;

const emptyDescStyle = css`
    margin: 0 0 16px;
    font-size: 12px;
    line-height: 1.5;
    color: ${MANAGE_TOKENS.text.label};
`;

const emptyActionsStyle = css`
    display: flex;
    gap: 8px;
    justify-content: center;
`;

const emptyPrimaryStyle = css`
    padding: 9px 14px;
    border-radius: 8px;
    border: none;
    background: ${MANAGE_TOKENS.accent};
    color: #fff;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

const emptySecondaryStyle = css`
    padding: 9px 14px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: ${MANAGE_TOKENS.card};
    color: ${MANAGE_TOKENS.text.primary};
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

export default LocationBasedEstimatePage;
