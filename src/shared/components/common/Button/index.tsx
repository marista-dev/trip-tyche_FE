import React, { ComponentPropsWithoutRef } from 'react';

import { css, SerializedStyles } from '@emotion/react';

import { COLORS, FONT_FAMILY, THEME_COLORS } from '@/shared/constants/style';
import theme from '@/shared/styles/theme';

type VariantType = 'primary' | 'white' | 'error';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
    variant?: VariantType;
    text?: string;
    icon?: React.ReactNode;
    isLoading?: boolean;
    loadingText?: string;
    customStyle?: SerializedStyles;
}

const Button = ({
    variant = 'primary',
    text,
    icon,
    isLoading = false,
    loadingText,
    disabled,
    customStyle,
    ...props
}: ButtonProps) => {
    return (
        <button
            css={[baseStyles, buttonStyle[variant](!disabled), customStyle]}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <p css={loadingStyle}>{loadingText}</p>
            ) : (
                <React.Fragment>
                    {icon && <span css={iconStyle(!!text)}>{icon}</span>}
                    {text}
                </React.Fragment>
            )}
        </button>
    );
};

const baseStyles = css`
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    border-radius: 8px;
    width: 100%;
    height: 48px;
    cursor: pointer;
    font-family: ${FONT_FAMILY};
    font-size: 17px;
    font-weight: 400;
    letter-spacing: -0.374px;
    transition:
        background-color 0.15s ease,
        opacity 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.85;
    }
`;

const buttonStyle = {
    primary: (isActive: boolean) => css`
        background-color: ${isActive ? COLORS.PRIMARY : COLORS.DISABLED};
        color: ${isActive ? '#ffffff' : COLORS.BUTTON.DISABLED_TEXT};

        @media (hover: hover) {
            &:hover {
                background-color: ${isActive ? COLORS.PRIMARY_HOVER : COLORS.DISABLED};
            }
        }

        &:disabled {
            cursor: not-allowed;
        }
    `,
    white: (isActive: boolean) => css`
        background-color: ${isActive ? COLORS.BUTTON.WHITE_BG : COLORS.DISABLED};
        color: ${isActive ? COLORS.SECONDARY : COLORS.BUTTON.DISABLED_TEXT};
        border: 1px solid ${isActive ? 'rgba(0,0,0,0.12)' : 'transparent'};

        @media (hover: hover) {
            &:hover {
                background-color: ${COLORS.BUTTON.WHITE_HOVER};
            }
        }

        &:active {
            background-color: ${COLORS.BUTTON.WHITE_HOVER};
        }
        &:disabled {
            cursor: not-allowed;
        }
    `,
    error: (isActive: boolean) => css`
        background-color: ${isActive ? THEME_COLORS.error.BACKGROUND : COLORS.DISABLED};
        color: ${isActive ? THEME_COLORS.error.TEXT : COLORS.DISABLED};

        @media (hover: hover) {
            &:hover {
                background-color: ${isActive ? COLORS.BUTTON.ERROR_HOVER : COLORS.DISABLED};
            }
        }
        &:disabled {
            cursor: not-allowed;
        }
    `,
};

const iconStyle = (isText: boolean) => css`
    display: flex;
    margin-right: ${isText ? '4px' : '0px'};
    align-items: center;
`;

const loadingStyle = css`
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    font-size: ${theme.FONT_SIZES.LG};
`;

export default Button;
