import { useCallback, useEffect, useState } from 'react';

import { css } from '@emotion/react';
import { useNavigate } from 'react-router-dom';

import MiniTicketPreview from '@/domains/media/components/upload/MiniTicketPreview';
import PassportStamp from '@/domains/media/components/upload/PassportStamp';
import { fadeUp, ink, slamEntry } from '@/domains/media/components/upload/tripUploadAnimations';
import { UploadStats } from '@/domains/media/hooks/useImageUpload';
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
    uploadStats?: UploadStats;
    onRetryUpload?: () => void;
}

const ERROR_UPLOAD_MSG = '일부 사진 업로드에 실패했습니다. 다시 시도해 주세요.';
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
    uploadStats,
    onRetryUpload,
}: TripCreateCompleteStepProps) => {
    const [phase, setPhase] = useState<Phase>(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const showToast = useToastStore((state) => state.showToast);
    const navigate = useNavigate();

    const stampDate = toStampDate(tripInfo.startDate) || toStampDate();

    const showUploadProgress = !!uploadStats && uploadStats.total > 0;
    const uploadCompleted = uploadStats ? uploadStats.succeeded + uploadStats.failed : 0;
    const uploadInFlight = showUploadProgress && uploadCompleted < uploadStats!.total;

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
            } catch {
                if (aborted()) return;
                setErrorMsg(ERROR_UPLOAD_MSG);
                showToast(ERROR_UPLOAD_MSG);
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
        // 실패한 파일만 재업로드 → 새 bg promise를 ref에 설치한 뒤 runPhases가 그것을 await.
        // onRetryUpload가 없거나 컨텍스트가 사라진 경우엔 기존 bg promise를 다시 await(= 같은 에러).
        onRetryUpload?.();
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
                            {phase === 0 && showUploadProgress && (
                                <p css={uploadProgressLine}>
                                    {uploadInFlight
                                        ? `이미지 ${uploadCompleted} / ${uploadStats!.total} 업로드 중...`
                                        : `이미지 ${uploadStats!.total}장 업로드 완료`}
                                    {uploadStats!.failed > 0 && (
                                        <span css={uploadFailedHint}> · {uploadStats!.failed}장 재시도 실패</span>
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

const uploadProgressLine = css`
    margin-top: 8px;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0.2px;
`;

const uploadFailedHint = css`
    color: #ef4444;
    font-weight: 700;
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
