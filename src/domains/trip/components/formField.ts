import { css } from '@emotion/react';

import { COLORS } from '@/shared/constants/style';

/* 등록·수정 폼과 여행지 입력칸이 함께 쓰는 입력칸 규격 */
export const FIELD = {
    HEIGHT: '44px',
    FONT_SIZE: '15px',
    LABEL_SIZE: '14px',
    HELP_SIZE: '12px',
    LABEL_GAP: '8px',
    SECTION_GAP: '20px',
    RADIUS: '10px',
} as const;

export const fieldLabel = css`
    margin: 0 0 ${FIELD.LABEL_GAP};
    font-size: ${FIELD.LABEL_SIZE};
    font-weight: 600;
    letter-spacing: -0.2px;
    color: ${COLORS.TEXT.BLACK};
`;

/** 입력칸 틀. Mantine 입력칸은 fieldOverrides로 같은 값을 쓴다. */
export const fieldBox = css`
    min-height: ${FIELD.HEIGHT};
    border: 1px solid ${COLORS.INPUT_BORDER};
    border-radius: ${FIELD.RADIUS};
    background: ${COLORS.BACKGROUND.WHITE};
    font-family: inherit;
    font-size: ${FIELD.FONT_SIZE};
    color: ${COLORS.TEXT.BLACK};
    transition: border-color 0.2s;
`;

/** 폼 안의 Mantine 입력칸을 fieldBox 규격에 맞춘다. */
export const fieldOverrides = css`
    .mantine-Input-input {
        height: ${FIELD.HEIGHT};
        min-height: ${FIELD.HEIGHT};
        border-color: ${COLORS.INPUT_BORDER};
        border-radius: ${FIELD.RADIUS};
        font-family: inherit;
        font-size: ${FIELD.FONT_SIZE};
        color: ${COLORS.TEXT.BLACK};
    }

    .mantine-Input-input::placeholder,
    .mantine-DatePickerInput-placeholder {
        color: ${COLORS.TEXT.PLACEHOLDER};
    }
`;

export const fieldHelp = css`
    font-size: ${FIELD.HELP_SIZE};
    line-height: 1.5;
    color: ${COLORS.TEXT.DESCRIPTION_LIGHT};
`;
