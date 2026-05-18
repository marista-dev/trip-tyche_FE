import { css } from '@emotion/react';

import { MANAGE_TOKENS } from '@/domains/media/components/manage/tokens';

type ContextTone = 'red' | 'amber';

interface TaskContextCardProps {
    tone: ContextTone;
    icon: React.ReactNode;
    children: React.ReactNode;
}

const TaskContextCard = ({ tone, icon, children }: TaskContextCardProps) => {
    const iconBg = tone === 'red' ? MANAGE_TOKENS.destructiveSoft : MANAGE_TOKENS.warningSoft;

    return (
        <div css={cardStyle}>
            <div css={iconWrapStyle(iconBg)}>{icon}</div>
            <p css={textStyle}>{children}</p>
        </div>
    );
};

const cardStyle = css`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 20px 12px;
    background: ${MANAGE_TOKENS.card};
    border-bottom: 1px solid ${MANAGE_TOKENS.border};
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

const textStyle = css`
    margin: 0;
    flex: 1;
    font-size: 13px;
    line-height: 1.45;
    color: #333;
`;

export default TaskContextCard;
