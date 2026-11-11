import React, { useEffect, useRef } from 'react';

import { css } from '@emotion/react';
import { AnimatePresence, motion, PanInfo, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';

import { COLORS } from '@/shared/constants/style';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxHeight?: string;
    /** 고정 높이. 주면 내용이 flex 열로 놓여 자식이 `flex: 1`로 남은 높이를 채울 수 있다. */
    height?: string;
    /** 시트 제목 요소의 id(aria-labelledby) */
    labelledBy?: string;
}

/** vh 값에 키보드에 맞춰 줄어드는 dvh를 덧붙인다(지원하지 않는 브라우저는 앞의 vh를 쓴다). */
const withDvh = (prop: string, value: string) => `${prop}: ${value}; ${prop}: ${value.replace(/vh$/, 'dvh')};`;

const BottomSheet = ({ isOpen, onClose, children, maxHeight = '80vh', height, labelledBy }: BottomSheetProps) => {
    const sheetRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const reduceMotion = useReducedMotion();

    // 열면 포커스를 시트로, 닫으면 연 버튼으로 — 안 그러면 화면낭독기가 뒤 화면을 읽는다.
    useEffect(() => {
        if (!isOpen) return;
        const opener = document.activeElement as HTMLElement | null;
        const raf = requestAnimationFrame(() => sheetRef.current?.focus({ preventScroll: true }));
        return () => {
            cancelAnimationFrame(raf);
            opener?.focus?.({ preventScroll: true });
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCloseRef.current();
        };
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 80 || info.velocity.y > 500) onClose();
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <React.Fragment>
                    <motion.div
                        css={backdropStyle}
                        role='presentation'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />
                    <motion.div
                        css={sheetStyle(maxHeight, height)}
                        ref={sheetRef}
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby={labelledBy}
                        tabIndex={-1}
                        drag='y'
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.2}
                        onDragEnd={handleDragEnd}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        // 튕기지 않는 ease-out-quart
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
                    >
                        <div css={handleBarStyle} />
                        {children}
                    </motion.div>
                </React.Fragment>
            )}
        </AnimatePresence>,
        document.body,
    );
};

const backdropStyle = css`
    position: fixed;
    inset: 0;
    background-color: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1100;
`;

/* 최대 428px(PC 웹에서 전체 폭 방지). 아래 여백에 시스템 바 높이 — 안드로이드 targetSdk 36은 edge-to-edge. */
const sheetStyle = (maxHeight: string, height?: string) => css`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 0 auto;
    max-width: 428px;
    ${withDvh('max-height', maxHeight)}
    ${height && `${withDvh('height', height)} display: flex; flex-direction: column;`}
    overflow-y: auto;
    background-color: ${COLORS.BACKGROUND.WHITE};
    border-radius: 20px 20px 0 0;
    padding: 14px 20px calc(28px + env(safe-area-inset-bottom, 0px));
    z-index: 1101;

    /* 프로그램으로 옮긴 포커스에는 포커스 링을 그리지 않는다 */
    &:focus,
    &:focus-visible {
        outline: none;
        box-shadow: none;
    }
`;

const handleBarStyle = css`
    flex-shrink: 0;
    width: 36px;
    height: 4px;
    background-color: rgba(0, 0, 0, 0.12);
    border-radius: 2px;
    margin: 0 auto 14px;
`;

export default BottomSheet;
