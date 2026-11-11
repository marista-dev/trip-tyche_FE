import React, { useEffect, useRef } from 'react';

import { css } from '@emotion/react';
import { AnimatePresence, motion, PanInfo, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxHeight?: string;
    /** 시트 제목 요소의 id. 화면낭독기가 시트를 열 때 이 제목을 읽는다. */
    labelledBy?: string;
}

const BottomSheet = ({ isOpen, onClose, children, maxHeight = '80vh', labelledBy }: BottomSheetProps) => {
    const sheetRef = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();

    /*
     * 열리면 포커스를 시트로 옮기고, 닫히면 연 버튼으로 돌려놓는다.
     * 안 그러면 화면낭독기 사용자는 시트가 떠도 뒤 화면을 계속 읽는다.
     */
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
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        if (info.offset.y > 80 || info.velocity.y > 500) {
            onClose();
        }
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
                        css={sheetStyle(maxHeight)}
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
                        // 튕기지 않고 부드럽게 멈추는 ease-out-quart. 동작 줄이기 설정이면 바로 나타난다.
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

/*
 * - 앱 화면과 같은 폭(최대 428px)으로 가운데 둔다. PC 웹에서 화면 전체로 펼쳐지지 않게.
 * - 높이는 dvh: 키보드가 올라오면 함께 줄어든다(vh는 그대로라 아래 내용이 키보드 뒤로 숨는다).
 * - 아래 여백에 시스템 바(제스처 바) 높이를 더한다. 안드로이드는 targetSdk 36부터 화면을 끝까지 그린다.
 */
const sheetStyle = (maxHeight: string) => css`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 0 auto;
    max-width: 428px;
    max-height: ${maxHeight};
    max-height: ${maxHeight.replace(/vh$/, 'dvh')};
    overflow-y: auto;
    background-color: #ffffff;
    border-radius: 20px 20px 0 0;
    padding: 14px 20px calc(28px + env(safe-area-inset-bottom, 0px));
    z-index: 1101;

    /* 프로그램으로 옮긴 포커스(시트 전체)에는 테두리를 그리지 않는다 */
    &:focus,
    &:focus-visible {
        outline: none;
        box-shadow: none;
    }
`;

const handleBarStyle = css`
    width: 36px;
    height: 4px;
    background-color: rgba(0, 0, 0, 0.12);
    border-radius: 2px;
    margin: 0 auto 14px;
`;

export default BottomSheet;
