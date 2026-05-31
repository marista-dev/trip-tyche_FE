import React, { useEffect } from 'react';

import { css, keyframes, SerializedStyles } from '@emotion/react';
import { createPortal } from 'react-dom';

interface ModalProps {
    closeModal?: () => void;
    isConfirm?: boolean;
    children: React.ReactNode;
    customStyle?: SerializedStyles;
    ariaLabel?: string;
}

const Modal = ({ closeModal, isConfirm = false, children, customStyle, ariaLabel }: ModalProps) => {
    useEffect(() => {
        if (!closeModal || isConfirm) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeModal();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeModal, isConfirm]);

    return createPortal(
        <React.Fragment>
            <div css={overlayStyle} onClick={!isConfirm ? closeModal : undefined} aria-hidden='true'></div>
            <div css={modalStyle(customStyle)} role='dialog' aria-modal='true' aria-label={ariaLabel}>
                {children}
            </div>
        </React.Fragment>,
        document.getElementById('portal-root') || document.body,
    );
};

const fadeIn = keyframes`
    from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
`;

const overlayFadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

const modalStyle = (customStyle?: SerializedStyles) => css`
    padding: 20px 16px 16px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: min(360px, calc(100vw - 32px));
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 14px;
    background-color: rgba(255, 255, 255, 0.95);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    box-shadow: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;
    z-index: 1000;
    animation: ${fadeIn} 200ms ease-out;
    ${customStyle}

    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`;

const overlayStyle = css`
    width: 100%;
    height: 100dvh;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.48);
    z-index: 999;
    cursor: pointer;
    animation: ${overlayFadeIn} 200ms ease-out;

    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`;

export default Modal;
