import { css } from '@emotion/react';

export const sheetTitle = css`
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.3px;
`;

export const sheetSubtitle = css`
    margin: 6px 0 14px;
    font-size: 13px;
    color: #666;
    line-height: 1.5;
`;

export const primaryButton = css`
    width: 100%;
    padding: 12px 0;
    border-radius: 12px;
    background: #0071e3;
    border: none;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
`;

export const outlineButton = css`
    flex: 1;
    padding: 12px 0;
    border-radius: 12px;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.12);
    color: #111;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
`;

export const accentButton = css`
    flex: 2;
    padding: 12px 0;
    border-radius: 12px;
    background: #0071e3;
    border: none;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
`;

export const buttonRow = css`
    display: flex;
    gap: 8px;
`;
