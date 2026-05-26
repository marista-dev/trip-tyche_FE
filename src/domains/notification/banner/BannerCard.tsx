import { useEffect } from 'react';

import { css } from '@emotion/react';
import { motion, PanInfo } from 'framer-motion';

import BoardingPassPreview from './BoardingPassPreview';
import { BANNER_DESIGN, BANNER_TITLE, buildBannerBody } from './constants';
import IconCircle from './IconCircle';
import { BannerMessage } from './types';

interface BannerCardProps {
    message: BannerMessage;
    expanded: boolean;
    onTap: () => void;
    onDismiss: () => void;
    onAccept: () => void;
    onReject: () => void;
}

const ENTER_TRANSITION = { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.9 };
const LAYOUT_TRANSITION = { type: 'spring' as const, stiffness: 320, damping: 30 };

const BannerCard: React.FC<BannerCardProps> = ({ message, expanded, onTap, onDismiss, onAccept, onReject }) => {
    const isPersistent = message.type === 'SHARED_REQUEST';

    useEffect(() => {
        if (isPersistent || expanded) return;
        const id = window.setTimeout(onDismiss, BANNER_DESIGN.timing.autoDismissMs);
        return () => window.clearTimeout(id);
    }, [message.id, expanded, isPersistent, onDismiss]);

    const handleDragEnd = (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
        if (expanded) return;
        if (info.offset.y < -BANNER_DESIGN.timing.swipeThresholdPx) onDismiss();
    };

    return (
        <motion.div
            layout
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } }}
            transition={ENTER_TRANSITION}
            drag={expanded ? false : 'y'}
            dragConstraints={{ top: -80, bottom: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            onClick={expanded ? undefined : onTap}
            css={[card, expanded ? cardExpanded : cardCollapsed]}
            style={{
                cursor: expanded ? 'default' : 'pointer',
                touchAction: 'none',
            }}
        >
            <motion.div layout='position' css={headRow}>
                <IconCircle type={message.type} />
                <div css={textCol}>
                    <div css={titleRow}>
                        <span css={titleText}>{BANNER_TITLE[message.type]}</span>
                        <span css={timeText}>방금</span>
                    </div>
                    <div css={bodyText}>{buildBannerBody(message)}</div>
                </div>
            </motion.div>

            {!expanded && !isPersistent && <div css={swipeHandle} aria-hidden />}

            {expanded && message.type === 'SHARED_REQUEST' && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...LAYOUT_TRANSITION, delay: 0.05 }}
                    css={expandedArea}
                >
                    <BoardingPassPreview tripTitle={message.tripTitle} />
                    <div css={actionRow}>
                        <button
                            type='button'
                            css={[actionBtn, rejectBtn]}
                            onClick={(e) => {
                                e.stopPropagation();
                                onReject();
                            }}
                        >
                            거절
                        </button>
                        <button
                            type='button'
                            css={[actionBtn, acceptBtn]}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAccept();
                            }}
                        >
                            여행에 참여하기
                        </button>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

const card = css`
    position: fixed;
    top: max(50px, calc(env(safe-area-inset-top) + 12px));
    left: 12px;
    right: 12px;
    max-width: 404px;
    margin: 0 auto;
    border-radius: ${BANNER_DESIGN.radius}px;
    background: ${BANNER_DESIGN.surface.background};
    backdrop-filter: ${BANNER_DESIGN.surface.backdropFilter};
    -webkit-backdrop-filter: ${BANNER_DESIGN.surface.backdropFilter};
    border: ${BANNER_DESIGN.surface.border};
    box-shadow: ${BANNER_DESIGN.surface.boxShadow};
    color: #111;
    overflow: hidden;
    z-index: ${BANNER_DESIGN.z};
    will-change: transform, opacity;

    @supports not (backdrop-filter: blur(1px)) {
        background: ${BANNER_DESIGN.surface.backgroundFallback};
    }
`;

const cardCollapsed = css`
    padding: 12px 16px;
`;

const cardExpanded = css`
    padding: 14px 18px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

const headRow = css`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const textCol = css`
    flex: 1;
    min-width: 0;
`;

const titleRow = css`
    display: flex;
    align-items: baseline;
    gap: 8px;
`;

const titleText = css`
    flex: 1;
    font-size: ${BANNER_DESIGN.text.title.size}px;
    font-weight: ${BANNER_DESIGN.text.title.weight};
    color: ${BANNER_DESIGN.text.title.color};
    letter-spacing: ${BANNER_DESIGN.text.title.letterSpacing}px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const timeText = css`
    font-size: ${BANNER_DESIGN.text.time.size}px;
    font-weight: ${BANNER_DESIGN.text.time.weight};
    color: ${BANNER_DESIGN.text.time.color};
    flex-shrink: 0;
`;

const bodyText = css`
    margin-top: 2px;
    font-size: ${BANNER_DESIGN.text.body.size}px;
    color: ${BANNER_DESIGN.text.body.color};
    line-height: ${BANNER_DESIGN.text.body.lineHeight};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const swipeHandle = css`
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
    height: 3px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.12);
    pointer-events: none;
`;

const expandedArea = css`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const actionRow = css`
    display: flex;
    gap: 8px;
`;

const actionBtn = css`
    padding: 12px 0;
    border-radius: 12px;
    border: none;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: -0.2px;
`;

const rejectBtn = css`
    flex: 1;
    background: ${BANNER_DESIGN.actions.reject.bg};
    color: ${BANNER_DESIGN.actions.reject.color};
`;

const acceptBtn = css`
    flex: 2;
    background: ${BANNER_DESIGN.actions.accept.bg};
    color: ${BANNER_DESIGN.actions.accept.color};
    box-shadow: ${BANNER_DESIGN.actions.accept.shadow};
`;

export default BannerCard;
