import { css } from '@emotion/react';
import { ChevronLeft, Trash2 } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

interface ManageHeaderProps {
    title: string;
    subtitle?: string;
    selectedCount?: number;
    onBack: () => void;
    onCancel?: () => void;
    onDelete?: () => void;
}

const ManageHeader = ({ title, subtitle, selectedCount = 0, onBack, onCancel, onDelete }: ManageHeaderProps) => {
    const isSelecting = selectedCount > 0;

    return (
        <header css={headerStyle}>
            <button css={iconButtonStyle} onClick={onBack} aria-label='뒤로 가기'>
                <ChevronLeft size={20} strokeWidth={2.2} />
            </button>

            <div css={titleColumnStyle}>
                <h1 css={titleStyle}>{isSelecting ? `${selectedCount}장 선택` : title}</h1>
                {!isSelecting && subtitle && <p css={subtitleStyle}>{subtitle}</p>}
            </div>

            {isSelecting && (
                <div css={actionGroupStyle}>
                    {onDelete && (
                        <button css={deleteButtonStyle} onClick={onDelete} type='button'>
                            <Trash2 size={14} strokeWidth={2.2} />
                            삭제
                        </button>
                    )}
                    {onCancel && (
                        <button css={cancelButtonStyle} onClick={onCancel} type='button'>
                            취소
                        </button>
                    )}
                </div>
            )}
        </header>
    );
};

const headerStyle = css`
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 54px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid ${MANAGE_TOKENS.border};
    font-family: ${MANAGE_TOKENS.font};
`;

const iconButtonStyle = css`
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: transparent;
    border: none;
    cursor: pointer;
    color: ${MANAGE_TOKENS.text.primary};
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.6;
    }
`;

const titleColumnStyle = css`
    flex: 1;
    min-width: 0;
`;

const titleStyle = css`
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: ${MANAGE_TOKENS.text.primary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const subtitleStyle = css`
    margin: 1px 0 0;
    font-size: 11px;
    color: ${MANAGE_TOKENS.text.muted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const actionGroupStyle = css`
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
`;

const deleteButtonStyle = css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 7px 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: ${MANAGE_TOKENS.destructive};
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.6;
    }
`;

const cancelButtonStyle = css`
    padding: 7px 10px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: ${MANAGE_TOKENS.text.primary};
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.6;
    }
`;

export default ManageHeader;
