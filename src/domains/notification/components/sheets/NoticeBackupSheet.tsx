import { css } from '@emotion/react';

import { primaryButton, sheetTitle } from './styles';
import { Notification } from '@/domains/notification/types';

interface NoticeBackupSheetProps {
    notification: Notification;
    onPrimary: () => void;
}

const NoticeBackupSheet: React.FC<NoticeBackupSheetProps> = ({ notification, onPrimary }) => {
    const { createdAt } = notification;

    const formattedDate = new Date(createdAt).toLocaleString('ko-KR');

    // TODO: 백엔드에서 실제 trip title 전달 시 "여행이" 앞에 trip title 삽입
    const summaryRows: [string, string][] = [
        // TODO: 백엔드에서 사진 수, 경로, 용량 전달 시 채우기
        ['사진', '—'],
        ['경로', '—'],
        ['용량', '—'],
        ['일시', formattedDate],
    ];

    return (
        <div>
            <h2 css={sheetTitle}>백업 완료</h2>
            <p css={subtitle}>여행이 안전하게 백업되었어요</p>

            <div css={summaryCard}>
                {summaryRows.map(([key, value]) => (
                    <div key={key} css={summaryRow}>
                        <span css={summaryKey}>{key}</span>
                        <span css={summaryValue}>{value}</span>
                    </div>
                ))}
            </div>

            <button type='button' css={primaryButton} onClick={onPrimary}>
                확인
            </button>
        </div>
    );
};

const subtitle = css`
    margin: 6px 0 16px;
    font-size: 13px;
    color: #666;
    line-height: 1.5;
`;

const summaryCard = css`
    background: #f5f5f5;
    border-radius: 12px;
    padding: 14px;
    margin-bottom: 16px;
`;

const summaryRow = css`
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 12px;
`;

const summaryKey = css`
    color: #888;
    font-weight: 600;
`;

const summaryValue = css`
    color: #111;
    font-weight: 700;
`;

export default NoticeBackupSheet;
