import { css } from '@emotion/react';
import { Check, Sparkles } from 'lucide-react';

import { primaryButton } from './styles';
import { Notification } from '@/domains/notification/types';

interface NoticeFeatureSheetProps {
    notification: Notification;
    onPrimary: () => void;
}

const FEATURE_LIST = ['시간대로 위치 추정', '위치로 날짜 추정', '사진별 개별 검토'];

const NoticeFeatureSheet: React.FC<NoticeFeatureSheetProps> = ({ notification: _notification, onPrimary }) => {
    return (
        <div>
            <div css={featureIcon}>
                <Sparkles size={24} />
            </div>

            <div css={newLabel}>NEW</div>
            <h2 css={featureTitle}>자동 추정 기능</h2>

            <p css={featureDesc}>
                위치나 날짜 정보가 없는 사진에서, 비슷한 시간이나 가까운 위치의 다른 사진을 기준으로 정보를 채워볼 수
                있어요.
            </p>

            <ul css={featureList}>
                {FEATURE_LIST.map((item) => (
                    <li key={item} css={featureItem}>
                        <Check size={14} color='#16a34a' strokeWidth={2.4} />
                        {item}
                    </li>
                ))}
            </ul>

            <button type='button' css={featurePrimaryButton} onClick={onPrimary}>
                지금 사용해보기 →
            </button>
        </div>
    );
};

const featureIcon = css`
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(168, 85, 247, 0.05));
    color: #a855f7;
    display: grid;
    place-items: center;
    margin-bottom: 14px;
`;

const newLabel = css`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.4px;
    color: #a855f7;
    text-transform: uppercase;
`;

const featureTitle = css`
    margin: 4px 0 0;
    font-size: 20px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.4px;
`;

const featureDesc = css`
    margin: 8px 0 14px;
    font-size: 13px;
    color: #555;
    line-height: 1.6;
`;

const featureList = css`
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    color: #666;
`;

const featureItem = css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
`;

const featurePrimaryButton = css`
    ${primaryButton};
    margin-top: 18px;
`;

export default NoticeFeatureSheet;
