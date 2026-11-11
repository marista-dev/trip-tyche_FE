import { ReactNode } from 'react';

import { css } from '@emotion/react';

import BottomSheet from '@/shared/components/common/BottomSheet/BottomSheet';
import { COLORS } from '@/shared/constants/style';

interface SheetAction {
    label: string;
    onClick: () => void;
}

interface SheetDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** 제목 위 아이콘 영역. 기본 배지(SheetDialog.Icon)나 직접 만든 요소를 넣는다. */
    icon?: ReactNode;
    title: string;
    description?: ReactNode;
    /** 설명과 버튼 사이에 들어갈 내용(혜택 목록, 기간 비교 등) */
    children?: ReactNode;
    primary: SheetAction;
    secondary?: SheetAction;
    /** 맨 아래 글자 버튼(취소·계속 둘러보기 등) */
    tertiary?: SheetAction;
}

/**
 * 바텀시트 형태의 확인 대화상자 — 아이콘 · 제목 · 설명 · (내용) · 버튼 3단.
 * 로그인 유도, 날짜 확인처럼 사용자의 선택을 받는 시트가 같은 모양을 쓰도록 한 곳에 둔다.
 */
const SheetDialog = ({
    isOpen,
    onClose,
    icon,
    title,
    description,
    children,
    primary,
    secondary,
    tertiary,
}: SheetDialogProps) => (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
        <div css={body}>
            {icon}
            <h2 css={titleStyle}>{title}</h2>
            {description && <p css={descriptionStyle}>{description}</p>}
            {children && <div css={content}>{children}</div>}
            <div css={actions}>
                <button type='button' css={primaryButton} onClick={() => primary.onClick()}>
                    {primary.label}
                </button>
                {secondary && (
                    <button type='button' css={secondaryButton} onClick={() => secondary.onClick()}>
                        {secondary.label}
                    </button>
                )}
                {tertiary && (
                    <button type='button' css={textButton} onClick={() => tertiary.onClick()}>
                        {tertiary.label}
                    </button>
                )}
            </div>
        </div>
    </BottomSheet>
);

/** 기본 아이콘 배지 — 옅은 파랑 바탕의 둥근 사각형 */
const SheetIcon = ({ children }: { children: ReactNode }) => <span css={iconBadge}>{children}</span>;

SheetDialog.Icon = SheetIcon;

const body = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 4px 4px 0;
`;

const iconBadge = css`
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    border-radius: 14px;
    background: ${COLORS.BACKGROUND.PRIMARY_LIGHT};
    color: ${COLORS.PRIMARY};
    display: grid;
    place-items: center;
`;

const titleStyle = css`
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.4px;
    line-height: 1.35;
    color: ${COLORS.TEXT.BLACK};
    word-break: keep-all;
`;

const descriptionStyle = css`
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.55;
    color: ${COLORS.TEXT.DESCRIPTION};
    word-break: keep-all;

    strong {
        color: ${COLORS.TEXT.BLACK};
    }
`;

const content = css`
    width: 100%;
    margin-top: 20px;
`;

const actions = css`
    width: 100%;
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const buttonBase = css`
    width: 100%;
    border: none;
    border-radius: 14px;
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:active {
        transform: scale(0.99);
    }
`;

const primaryButton = css`
    ${buttonBase};
    height: 52px;
    background: ${COLORS.PRIMARY};
    color: ${COLORS.TEXT.WHITE};
    font-size: 15px;
    font-weight: 700;

    @media (hover: hover) {
        &:hover {
            background: ${COLORS.PRIMARY_HOVER};
        }
    }
`;

const secondaryButton = css`
    ${buttonBase};
    height: 48px;
    background: ${COLORS.SURFACE_SOFT};
    color: ${COLORS.TEXT.BLACK};
    font-size: 14px;
    font-weight: 600;
`;

const textButton = css`
    ${buttonBase};
    height: 40px;
    background: none;
    color: ${COLORS.TEXT.SECONDARY};
    font-size: 14px;
    font-weight: 600;
`;

export default SheetDialog;
