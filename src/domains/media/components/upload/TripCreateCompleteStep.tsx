import { useCallback, useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { useNavigate } from 'react-router-dom';

import MiniTicketPreview from '@/domains/media/components/upload/MiniTicketPreview';
import PassportStamp from '@/domains/media/components/upload/PassportStamp';
import { fadeUp, ink, slamEntry } from '@/domains/media/components/upload/tripUploadAnimations';
import { isUploadInProgress } from '@/domains/media/hooks/useUploadGuard';
import { useUploadSessionStore } from '@/domains/media/stores/useUploadSessionStore';
import type { UploadPhase, UploadStats } from '@/domains/media/utils/uploadChain';
import { describeUploadError, describeUploadProgress } from '@/domains/media/utils/uploadMessages';
import { TripInfo } from '@/domains/trip/types';
import Button from '@/shared/components/common/Button';
import { ROUTES } from '@/shared/constants/route';
import { useToastStore } from '@/shared/stores/useToastStore';

type Phase = 0 | 1 | 2;

interface TripCreateCompleteStepProps {
    tripInfo: TripInfo;
    waitForBackgroundUpload: () => Promise<void>;
    onUpdateForm?: () => Promise<{ success: boolean; error?: string }>;
    onFinalize: () => Promise<{ success: boolean; error?: string } | void>;
    coverPhotoUrl?: string;
    ownerNickname?: string;
    photoCount?: number;
    onRetryUpload?: () => void;
    /** 전송 중에는 서버 처리 수 대신 전송 수를 보여 준다. 전송이 끝나기 전에는 처리 수가 0에 머문다. */
    uploadPhase?: UploadPhase;
    uploadStats?: UploadStats;
}

// 업로드 체인이 단계를 알려 주지 않은 실패에만 쓴다(단계별 안내는 describeUploadError)
const ERROR_UPLOAD_MSG = '사진 업로드에 실패했습니다. 다시 시도해 주세요.';
const ERROR_FORM_MSG = '여행 정보 저장에 실패했습니다.';
const ERROR_FINALIZE_MSG = '티켓 발급에 실패했습니다.';

/** YY·MM·DD 포맷. iso가 비었거나 invalid면 빈 문자열 반환. */
const toStampDate = (iso?: string) => {
    const dt = iso ? new Date(iso) : new Date();
    if (isNaN(+dt)) return '';
    const yy = String(dt.getFullYear()).slice(2);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}·${mm}·${dd}`;
};

const TripCreateCompleteStep = ({
    tripInfo,
    waitForBackgroundUpload,
    onUpdateForm,
    onFinalize,
    coverPhotoUrl,
    ownerNickname,
    photoCount,
    onRetryUpload,
    uploadPhase,
    uploadStats,
}: TripCreateCompleteStepProps) => {
    const [phase, setPhase] = useState<Phase>(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const showToast = useToastStore((state) => state.showToast);
    const navigate = useNavigate();

    const totalCount = useUploadSessionStore((s) => s.totalCount);
    const processedCount = useUploadSessionStore((s) => s.processedCount);
    const failedCount = useUploadSessionStore((s) => s.failedCount);

    // 준비 단계가 실패하면 사진 미리보기(photoCount)가 없어 업로드 장수로 채운다
    const displayTotal = totalCount > 0 ? totalCount : (photoCount ?? uploadStats?.total ?? 0);
    const transferText = uploadPhase && uploadStats ? describeUploadProgress(uploadPhase, uploadStats) : null;

    const stampDate = toStampDate(tripInfo.startDate) || toStampDate();

    /** waitForBackgroundUpload → updateForm → finalize → phase2 시퀀스. cancellation token으로 unmount 안전성 확보. */
    const runPhases = useCallback(
        async (signal?: { cancelled: boolean }) => {
            const aborted = () => signal?.cancelled === true;
            try {
                await waitForBackgroundUpload();
                if (aborted()) return;

                // 페이지 전환은 즉시 일어났으므로, 백엔드 trip 정보 PUT은 여기서 await.
                // 실패 시 retry 가능(handleRetry가 runPhases를 다시 호출 → handleUpdateForm이 mutateAsync 재발사).
                if (onUpdateForm) {
                    const updateResult = await onUpdateForm();
                    if (aborted()) return;
                    if (!updateResult.success) {
                        const msg = updateResult.error || ERROR_FORM_MSG;
                        setErrorMsg(msg);
                        showToast(msg);
                        return;
                    }
                }

                setPhase(1);

                const result = await onFinalize();
                if (aborted()) return;

                if (result && 'success' in result && !result.success) {
                    const msg = result.error || ERROR_FINALIZE_MSG;
                    setErrorMsg(msg);
                    showToast(msg);
                    return;
                }
                setPhase(2);
            } catch (error) {
                if (aborted()) return;
                const msg = describeUploadError(error, ERROR_UPLOAD_MSG);
                setErrorMsg(msg);
                showToast(msg);
            }
        },
        [waitForBackgroundUpload, onUpdateForm, onFinalize, showToast],
    );

    useEffect(() => {
        const signal = { cancelled: false };
        void runPhases(signal);
        return () => {
            signal.cancelled = true;
        };
    }, [runPhases]);

    const handleRetry = () => {
        setErrorMsg(null);
        setPhase(0);
        // 끝나지 않은 일(URL 발급부터 미전송·미등록·status 전환까지)만 다시 한다 → 새 bg promise를 ref에 설치한 뒤 runPhases가 그것을 await.
        // 업로드는 끝났고 정보 저장·발급만 실패했다면 다시 할 일이 없어, 성공한 기존 promise를 await하고 다음 단계로 간다.
        // 온라인 복귀 재시도 등이 이미 돌고 있으면 끊고 새로 띄우지 않는다. runPhases가 그 실행을 기다린다.
        if (!uploadPhase || !isUploadInProgress(uploadPhase)) onRetryUpload?.();
        void runPhases();
    };

    return (
        <div css={container}>
            <div css={contentArea}>
                <div css={titleBlock}>
                    {phase < 2 ? (
                        <div key={phase} css={phaseTextWrap}>
                            <div css={kicker}>{phase === 0 ? '티켓 확인 중' : '색상 적용 중'}</div>
                            <h2 css={waitingTitle}>{phase === 0 ? '잠시만 기다려 주세요' : '티켓을 완성하는 중...'}</h2>
                            {phase === 0 && (transferText || displayTotal > 0) && (
                                <p css={progressLine} role='status' aria-live='polite'>
                                    {transferText ?? (
                                        <>
                                            사진 처리 {processedCount} / {displayTotal}
                                            {failedCount > 0 && ` · 실패 ${failedCount}`}
                                        </>
                                    )}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div css={phaseTextWrap}>
                            <h2 css={doneTitle}>티켓이 발급되었습니다</h2>
                            <p css={doneSubtitle}>여행이 공식 기록되었어요</p>
                        </div>
                    )}
                </div>

                <div css={ticketArea}>
                    <div css={ticketFilter(phase)}>
                        <MiniTicketPreview
                            trip={tripInfo}
                            ownerNickname={ownerNickname}
                            coverPhotoUrl={coverPhotoUrl}
                            photoCount={photoCount}
                        />
                    </div>
                    {phase === 2 &&
                        Array.from({ length: 12 }).map((_, i) => {
                            const ang = (i * 30 * Math.PI) / 180;
                            const dist = 32 + (i % 3) * 12;
                            const sizePx = 4 + (i % 2);
                            return (
                                <span
                                    key={i}
                                    css={inkDot}
                                    style={{
                                        width: sizePx,
                                        height: sizePx,
                                        ['--dx' as string]: `${Math.cos(ang) * dist}px`,
                                        ['--dy' as string]: `${Math.sin(ang) * dist}px`,
                                        animationDelay: `${0.85 + i * 0.025}s`,
                                    }}
                                />
                            );
                        })}
                    {phase === 2 && (
                        <div css={stampWrap}>
                            <PassportStamp size={130} color='#dc2626' city='ENTRY' brand='TRIPTYCHE' date={stampDate} />
                        </div>
                    )}
                </div>
            </div>

            <div css={footer}>
                {errorMsg ? (
                    <Button text='다시 시도하기' onClick={handleRetry} />
                ) : (
                    <Button
                        text={phase < 2 ? '발급 중...' : '티켓 보기'}
                        onClick={() => navigate(ROUTES.PATH.TICKETS)}
                        disabled={phase < 2}
                    />
                )}
            </div>
        </div>
    );
};

const container = css`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const contentArea = css`
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 4px 4px 12px;
`;

const titleBlock = css`
    text-align: center;
    margin-bottom: 16px;
`;

const phaseTextWrap = css`
    animation: ${fadeUp} 0.4s ease-out both;
`;

const kicker = css`
    font-size: 10px;
    font-weight: 700;
    color: #cbd5e1;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    margin-bottom: 6px;
`;

const waitingTitle = css`
    font-size: 18px;
    font-weight: 900;
    color: #94a3b8;
    letter-spacing: -0.3px;
    line-height: 1.2;
`;

const progressLine = css`
    margin-top: 10px;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 0.2px;
    font-variant-numeric: tabular-nums;
`;

const doneTitle = css`
    font-size: 20px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -0.3px;
    line-height: 1.2;
`;

const doneSubtitle = css`
    font-size: 12px;
    color: #94a3b8;
    margin-top: 5px;
    font-weight: 500;
`;

const ticketArea = css`
    position: relative;
`;

const ticketFilter = (phase: Phase) => css`
    filter: ${phase === 0 ? 'grayscale(1) brightness(0.82)' : 'grayscale(0) brightness(1)'};
    transition: filter 0.9s ease-out;
`;

const inkDot = css`
    position: absolute;
    top: 73px;
    right: 77px;
    z-index: 6;
    border-radius: 50%;
    background: #dc2626;
    animation: ${ink} 0.9s ease-out both;
    transform-origin: 0 0;
`;

const stampWrap = css`
    position: absolute;
    top: 8px;
    right: 12px;
    z-index: 7;
    transform-origin: 50% 50%;
    animation: ${slamEntry} 1.4s cubic-bezier(0.5, 0, 0.5, 1) both;
`;

const footer = css`
    padding: 12px 0 0;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(8px);
    border-top: 1px solid #f1f5f9;
`;

export default TripCreateCompleteStep;
