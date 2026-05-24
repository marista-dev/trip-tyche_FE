import { css } from '@emotion/react';
import { CheckCircle2, XCircle } from 'lucide-react';

import { primaryButton, sheetTitle } from './styles';
import { NOTIFICATION_TITLE } from '@/domains/notification/constants';
import { Notification } from '@/domains/notification/types';

interface ShareResultSheetProps {
    notification: Notification;
    onPrimary: () => void;
    onRemove: () => void;
}

const ShareResultSheet: React.FC<ShareResultSheetProps> = ({ notification, onPrimary, onRemove }) => {
    const { message, senderNickname } = notification;
    const ok = message === 'SHARED_APPROVE';

    return (
        <div css={centerWrap}>
            <div css={iconCircle(ok)}>{ok ? <CheckCircle2 size={24} /> : <XCircle size={24} />}</div>

            <h2 css={sheetTitle}>{NOTIFICATION_TITLE[message]}</h2>

            {/* TODO: 백엔드에서 실제 trip title 전달 시 "공유받은 여행" 대신 사용 */}
            <p css={subtitle}>
                {senderNickname}님이 &quot;공유받은 여행&quot; 초대를 {ok ? '수락' : '거절'}했습니다
            </p>

            <button type='button' css={primaryButton} onClick={onPrimary}>
                {ok ? '여행 보러가기' : '확인'}
            </button>
            <button type='button' css={removeButton} onClick={onRemove}>
                알림 삭제
            </button>
        </div>
    );
};

const centerWrap = css`
    text-align: center;
    padding: 12px 0;
`;

const iconCircle = (ok: boolean) => css`
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: ${ok ? '#dcfce7' : '#fee2e2'};
    color: ${ok ? '#16a34a' : '#dc2626'};
    display: grid;
    place-items: center;
    margin: 0 auto 14px;
`;

const subtitle = css`
    margin: 6px 0 22px;
    font-size: 13px;
    color: #666;
    line-height: 1.5;
`;

const removeButton = css`
    margin-top: 8px;
    width: 100%;
    padding: 10px 0;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
`;

export default ShareResultSheet;
