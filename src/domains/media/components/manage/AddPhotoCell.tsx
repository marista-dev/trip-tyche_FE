import { css } from '@emotion/react';
import { Plus } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

interface AddPhotoCellProps {
    onClick: () => void;
}

const AddPhotoCell = ({ onClick }: AddPhotoCellProps) => (
    <button type='button' css={cellStyle} onClick={onClick} aria-label='사진 추가'>
        <Plus size={22} strokeWidth={2} />
    </button>
);

const cellStyle = css`
    aspect-ratio: 1 / 1;
    width: 100%;
    border-radius: ${MANAGE_TOKENS.radius.pill}px;
    border: 1.5px dashed ${MANAGE_TOKENS.accent};
    background: transparent;
    color: ${MANAGE_TOKENS.accent};
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: background 150ms ease;
    -webkit-tap-highlight-color: transparent;
    &:hover {
        background: ${MANAGE_TOKENS.accentSoft};
    }
    &:active {
        background: ${MANAGE_TOKENS.accentSoft};
    }
`;

export default AddPhotoCell;
