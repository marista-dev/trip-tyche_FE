import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { Clock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import EstimateTargetTab from '@/domains/media/components/manage/EstimateTargetTab';
import ManageHeader from '@/domains/media/components/manage/ManageHeader';
import ReferencePhotoCard from '@/domains/media/components/manage/ReferencePhotoCard';
import StickyApplyCTA from '@/domains/media/components/manage/StickyApplyCTA';
import { managePageContainerStyle } from '@/domains/media/components/manage/styles';
import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';
import { useMetadataUpdate } from '@/domains/media/hooks/mutations';
import { useTripPhotos } from '@/domains/media/hooks/queries';
import { useEstimateStore } from '@/domains/media/stores/useEstimateStore';
import { MediaFile } from '@/domains/media/types';
import { extractTimeOfDay, findNearbyPhotosByTime, formatTimeDiff } from '@/domains/media/utils';
import { formatKoreanDate } from '@/libs/utils/date';
import { hasValidLocation } from '@/libs/utils/validate';
import Indicator from '@/shared/components/common/Spinner/Indicator';
import { ROUTES } from '@/shared/constants/route';
import { useToastStore } from '@/shared/stores/useToastStore';

const TimeBasedEstimatePage = () => {
    const { tripKey = '' } = useParams<{ tripKey: string }>();
    const navigate = useNavigate();
    const { showToast } = useToastStore();
    const { mode, tripKey: storeTripKey, targets, clear } = useEstimateStore();

    const mainScrollRef = useRef<HTMLElement>(null);
    const targetsRowRef = useRef<HTMLDivElement>(null);

    const { photos: pool, isLoading } = useTripPhotos(tripKey);
    const { mutate: updateMutate, isPending: isApplying } = useMetadataUpdate();

    useEffect(() => {
        if (!isLoading && (targets.length === 0 || mode !== 'time' || storeTripKey !== tripKey)) {
            showToast('처리할 사진을 다시 선택해주세요');
            navigate(ROUTES.PATH.TRIP.EDIT.NO_LOCATION(tripKey), { replace: true });
        }
    }, [isLoading, mode, storeTripKey, tripKey, targets.length, navigate, showToast]);

    // 처리할 사진을 과거 → 최신 순으로 정렬 + pool에서 이미 위치가 채워진 사진(이전 처리 완료)을 제외.
    // MapPick 서브플로우에서 한 장씩 위치 적용하고 돌아왔을 때 자동으로 리스트에서 빠짐.
    const sortedTargets = useMemo(() => {
        const stillUnresolved = targets.filter((t) => {
            const current = pool.find((p) => p.mediaFileId === t.mediaFileId);
            // pool에 없거나(이상 케이스) location 여전히 빈 경우만 처리 대상
            if (!current) return true;
            return !hasValidLocation({ latitude: current.latitude, longitude: current.longitude });
        });
        return [...stillUnresolved].sort(
            (a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime(),
        );
    }, [targets, pool]);

    const [activeId, setActiveId] = useState<number | null>(null);
    const [picks, setPicks] = useState<Record<number, number>>({});

    // activeId가 (1) null이거나 (2) 처리된 사진이라 sortedTargets에서 빠졌으면 첫 항목으로 자동 이동
    useEffect(() => {
        if (sortedTargets.length === 0) return;
        if (activeId === null || !sortedTargets.some((t) => t.mediaFileId === activeId)) {
            setActiveId(sortedTargets[0].mediaFileId);
        }
    }, [sortedTargets, activeId]);

    // 모든 target이 처리되면 자동으로 뒤로 (NoLocation 페이지로 자연 복귀)
    useEffect(() => {
        if (isLoading) return;
        if (targets.length > 0 && sortedTargets.length === 0 && mode === 'time') {
            showToast('모든 사진의 위치가 업데이트되었어요');
            clear();
            navigate(-1);
        }
    }, [isLoading, targets.length, sortedTargets.length, mode, clear, navigate, showToast]);

    // activeId 변경 시 main scroll을 top으로, 가로 target row를 active tab으로 자동 스크롤.
    // 건너뛰기 후 새 nearby 리스트가 위부터 보이게 + 활성 tab을 시야 안으로 가져옴.
    useEffect(() => {
        if (activeId === null) return;
        mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        const row = targetsRowRef.current;
        if (row) {
            const activeBtn = row.querySelector<HTMLButtonElement>(`[data-target-id="${activeId}"]`);
            activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeId]);

    const activeTarget = sortedTargets.find((t) => t.mediaFileId === activeId) || null;

    const nearby = useMemo(() => {
        if (!activeTarget) return [];
        return findNearbyPhotosByTime(activeTarget, pool);
    }, [activeTarget, pool]);

    const totalApplied = Object.keys(picks).length;

    // 건너뛰기: 1장이면 뒤로, 여러 장이면 다음 미해결 사진으로 이동(시간 오름차순), 없으면 뒤로
    const skipActive = useCallback(() => {
        if (sortedTargets.length <= 1) {
            navigate(-1);
            return;
        }
        const currentIdx = sortedTargets.findIndex((t) => t.mediaFileId === activeId);
        // 현재 이후부터 다음 미선택 사진을 찾고, 없으면 처음부터 다시
        const rotated = [...sortedTargets.slice(currentIdx + 1), ...sortedTargets.slice(0, currentIdx)];
        const next = rotated.find((t) => picks[t.mediaFileId] === undefined);
        if (next) {
            setActiveId(next.mediaFileId);
        } else {
            // 다른 미선택 대상이 없음 → 뒤로
            navigate(-1);
        }
    }, [sortedTargets, activeId, picks, navigate]);

    const handleApply = () => {
        const updated: MediaFile[] = sortedTargets
            .filter((t) => picks[t.mediaFileId] !== undefined)
            .map((t) => {
                const ref = pool.find((p) => p.mediaFileId === picks[t.mediaFileId]);
                if (!ref) return t;
                return { ...t, latitude: ref.latitude, longitude: ref.longitude };
            });

        if (updated.length === 0) return;

        updateMutate(
            { tripKey, images: updated },
            {
                onSuccess: (result) => {
                    if (result.success) {
                        showToast(`${updated.length}장의 위치가 업데이트되었어요`);
                        // 페이지 머무름: picks만 리셋 → useMetadataUpdate가 trip-images invalidate →
                        // pool 갱신 → sortedTargets에서 처리된 사진 빠짐 → activeId 자동으로 다음 미해결로 이동.
                        // 모든 사진 처리됐을 땐 sortedTargets.length === 0 useEffect가 자동 navigate(-1).
                        setPicks({});
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
        <div css={managePageContainerStyle}>
            {isApplying && <Indicator text='적용 중...' />}

            <ManageHeader
                title='비슷한 시간 사진 찾기'
                subtitle='같은 위치일 가능성이 있는 사진을 골라주세요'
                onBack={() => navigate(-1)}
            />

            <div css={targetsSectionStyle}>
                <div css={targetsLabelStyle}>처리할 사진 · {sortedTargets.length}장</div>
                <div ref={targetsRowRef} css={targetsRowStyle}>
                    {sortedTargets.map((t) => (
                        <EstimateTargetTab
                            key={t.mediaFileId}
                            photo={t}
                            active={t.mediaFileId === activeId}
                            done={!!picks[t.mediaFileId]}
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
                        {(() => {
                            const date = formatKoreanDate(activeTarget.recordDate);
                            const time = extractTimeOfDay(activeTarget.recordDate);
                            if (!date && !time) return '시간 미상의 사진';
                            return `${date} ${time}에 찍힌 사진`.trim();
                        })()}
                    </p>
                    <p css={activeSubStyle}>±30분 범위 내 위치 있는 사진을 찾았어요</p>
                </div>
            </div>

            <main ref={mainScrollRef} css={listStyle}>
                {nearby.length === 0 ? (
                    <div css={emptyCardStyle}>
                        <div css={emptyIconStyle}>
                            <Clock size={28} strokeWidth={2.2} color={MANAGE_TOKENS.text.muted} />
                        </div>
                        <h4 css={emptyTitleStyle}>비슷한 시간의 사진이 없어요</h4>
                        <p css={emptyDescStyle}>
                            지도에서 직접 위치를 선택하거나
                            <br />
                            다른 사진을 처리해주세요
                        </p>
                        <div css={emptyActionsStyle}>
                            <button
                                type='button'
                                css={emptyPrimaryStyle}
                                onClick={() => {
                                    if (!activeTarget) return;
                                    // store는 그대로 두고(time estimate 컨텍스트 보존), navigate state로
                                    // 단일 target만 전달. MapPickPage에서 navState 분기 처리 → 적용 후
                                    // navigate(-1)로 이 페이지에 돌아왔을 때 time 모드 가드 통과.
                                    navigate(ROUTES.PATH.TRIP.EDIT.MAP_PICK(tripKey), {
                                        state: { singleTarget: activeTarget },
                                    });
                                }}
                            >
                                지도에서 선택
                            </button>
                            <button type='button' css={emptySecondaryStyle} onClick={skipActive}>
                                건너뛰기
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h3 css={listLabelStyle}>같은 위치일 가능성이 있는 사진</h3>
                        <div css={cardsStyle}>
                            {nearby.map((ref) => {
                                const isPicked = picks[activeTarget.mediaFileId] === ref.mediaFileId;
                                return (
                                    <ReferencePhotoCard
                                        key={ref.mediaFileId}
                                        mediaLink={ref.mediaLink}
                                        primaryLabel={`${formatKoreanDate(ref.recordDate)} ${extractTimeOfDay(ref.recordDate)}`.trim()}
                                        secondaryLabel={formatTimeDiff(ref.diffMs)}
                                        metaIcon='location'
                                        latitude={ref.latitude}
                                        longitude={ref.longitude}
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
                        <p css={hintStyle}>
                            사진을 골라 같은 위치로 표시할 수 있어요.
                            <br />
                            적용 후에도 개별 사진에서 위치를 수정할 수 있어요.
                        </p>
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
    align-items: center;
    gap: 8px;
    /* active tab(108px height + shadow)을 위한 vertical breathing room. */
    padding: 8px 4px;
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
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: ${MANAGE_TOKENS.text.primary};
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
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: ${MANAGE_TOKENS.text.label};
`;

const emptyActionsStyle = css`
    display: flex;
    gap: 8px;
    margin-top: 16px;
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

export default TimeBasedEstimatePage;
