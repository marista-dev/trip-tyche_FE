import { css } from '@emotion/react';
import { Calendar, MapPin } from 'lucide-react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

type IssueTone = 'red' | 'amber';

interface IssueCardProps {
    tone: IssueTone;
    title: string;
    sub: string;
    count: number;
    onResolve: () => void;
}

const ICONS: Record<IssueTone, JSX.Element> = {
    red: <MapPin size={18} strokeWidth={2.2} color={MANAGE_TOKENS.destructive} />,
    amber: <Calendar size={18} strokeWidth={2.2} color={MANAGE_TOKENS.warning} />,
};

const IssueCard = ({ tone, title, sub, count, onResolve }: IssueCardProps) => {
    const accent = tone === 'red' ? MANAGE_TOKENS.destructive : MANAGE_TOKENS.warning;
    const borderColor = tone === 'red' ? MANAGE_TOKENS.destructiveBorder : MANAGE_TOKENS.warningBorder;
    const iconBg = tone === 'red' ? MANAGE_TOKENS.destructiveSoft : MANAGE_TOKENS.warningSoft;

    return (
        <div css={cardStyle(borderColor)}>
            <div css={iconWrapStyle(iconBg)}>{ICONS[tone]}</div>
            <div css={bodyStyle}>
                <div css={titleRowStyle}>
                    <span css={titleTextStyle}>{title}</span>
                    <span css={countStyle(accent)}>{count}장</span>
                </div>
                <p css={subStyle}>{sub}</p>
            </div>
            <button type='button' css={resolveButtonStyle(accent)} onClick={onResolve}>
                해결
            </button>
        </div>
    );
};

const cardStyle = (borderColor: string) => css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    margin-bottom: 8px;
    background: ${MANAGE_TOKENS.card};
    border-radius: 12px;
    border: 1px solid ${borderColor};
    font-family: ${MANAGE_TOKENS.font};
`;

const iconWrapStyle = (bg: string) => css`
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: ${bg};
    border-radius: 10px;
`;

const bodyStyle = css`
    flex: 1;
    min-width: 0;
`;

const titleRowStyle = css`
    display: flex;
    align-items: baseline;
    gap: 6px;
`;

const titleTextStyle = css`
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: ${MANAGE_TOKENS.text.primary};
`;

const countStyle = (accent: string) => css`
    font-size: 12px;
    font-weight: 700;
    color: ${accent};
`;

const subStyle = css`
    margin: 1px 0 0;
    font-size: 11px;
    color: ${MANAGE_TOKENS.text.label};
`;

const resolveButtonStyle = (accent: string) => css`
    flex-shrink: 0;
    padding: 7px 12px;
    border: none;
    border-radius: 8px;
    background: ${accent};
    color: #fff;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    &:active {
        opacity: 0.85;
    }
`;

export default IssueCard;
