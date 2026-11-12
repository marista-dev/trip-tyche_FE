import { css } from '@emotion/react';
import { Plus, Trash } from 'lucide-react';

import { boardingPassShape } from '@/domains/trip/components/ticket/BoardingPassTicket';
import { COLORS } from '@/shared/constants/style';

interface DraftTicketOverlayProps {
    onContinue: () => void;
    onDelete: () => void;
}

const DraftTicketOverlay = ({ onContinue, onDelete }: DraftTicketOverlayProps) => (
    <div css={overlayStyle}>
        <div css={actionGroupStyle}>
            <button css={continueButtonStyle} onClick={onContinue} aria-label='여행 정보 이어서 작성하기'>
                <Plus size={14} aria-hidden='true' /> 여행 정보 이어서 작성하기
            </button>
            <div css={separatorStyle} aria-hidden='true' />
            <button css={deleteButtonStyle} onClick={onDelete} aria-label='삭제하기'>
                <Trash size={14} aria-hidden='true' /> 삭제하기
            </button>
        </div>
    </div>
);

const overlayStyle = css`
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.48);
    ${boardingPassShape}
    z-index: 9;
    cursor: pointer;
`;

const actionGroupStyle = css`
    display: flex;
    align-items: center;
    gap: 6px;
    color: ${COLORS.TEXT.TITLE};
    background-color: ${COLORS.BACKGROUND.WHITE};
    border: none;
    border-radius: 24px;
    cursor: pointer;
    box-shadow: ${COLORS.BOX_SHADOW.PHOTO_CARD};
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.224px;
`;

const actionButtonStyle = css`
    padding: 10px 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
`;

const continueButtonStyle = css`
    ${actionButtonStyle}
    color: ${COLORS.TEXT.DESCRIPTION};
`;

const deleteButtonStyle = css`
    ${actionButtonStyle}
    color: ${COLORS.TEXT.ERROR};
`;

const separatorStyle = css`
    width: 1px;
    height: 60%;
    background: ${COLORS.BORDER};
    align-self: center;
    flex-shrink: 0;
`;

export default DraftTicketOverlay;
