import React, { useEffect, useRef } from 'react';

import { css } from '@emotion/react';
import { AnimatePresence, motion, PanInfo } from 'framer-motion';
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
                        transition={{ duration: 0.32, ease: [0.34, 1.4, 0.64, 1] }}
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

const sheetStyle = (maxHeight: string) => css`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: ${maxHeight};
    overflow-y: auto;
    background-color: #ffffff;
    border-radius: 20px 20px 0 0;
    padding: 14px 20px 28px;
    z-index: 1101;

    /* 프로그램으로 옮긴 포커스(시트 전체)에는 테두리를 그리지 않는다 */
    &:focus {
        outline: none;
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
