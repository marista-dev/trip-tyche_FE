import { css, keyframes } from '@emotion/react';

import { MANY_TICKETS } from './ringLayout';
import { RingTicket } from './ticketTexture';

interface TicketRingCaptionProps {
    tickets: RingTicket[];
    activeIndex: number;
    visible: boolean;
}

/** 링 아래 캡션: 경로·기간 / 제목 / 날짜 / 위치 표시 / 조작 힌트 */
const TicketRingCaption = ({ tickets, activeIndex, visible }: TicketRingCaptionProps) => {
    const ticket = tickets[activeIndex];
    if (!ticket) return null;
    const { view, completed } = ticket;
    const count = tickets.length;

    return (
        <div css={[wrap, visible && wrapVisible]} aria-live='polite'>
            <div key={`${ticket.tripKey}-route`} css={[route, fadeIn]}>
                {completed ? `${view.routeText} · ${view.duration}` : '작성 중 · 도착지 미정'}
            </div>
            <div key={`${ticket.tripKey}-title`} css={[title, fadeIn]}>
                {completed ? ticket.title : '작성 중인 여행'}
                {!completed && <span css={draftBadge}>작성 중</span>}
            </div>
            <div key={`${ticket.tripKey}-date`} css={[date, fadeIn]}>
                {view.dateLine || '날짜를 아직 정하지 않았어요'}
            </div>

            {count > 1 &&
                (count <= MANY_TICKETS ? (
                    <div css={dots} aria-label={`${count}장 중 ${activeIndex + 1}번째`}>
                        {tickets.map((t, i) => (
                            <i key={t.tripKey} css={[dot, i === activeIndex && dotOn]} />
                        ))}
                    </div>
                ) : (
                    <div css={counter}>
                        {String(activeIndex + 1).padStart(2, '0')} <span>/ {String(count).padStart(2, '0')}</span>
                    </div>
                ))}
            <div css={hint}>
                {count > 1 ? '좌우로 드래그해서 링 돌리기 · 앞 티켓을 탭해 열기' : '티켓을 탭해서 열기'}
            </div>
        </div>
    );
};

export default TicketRingCaption;

const wrap = css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(30px + env(safe-area-inset-bottom));
    z-index: 40;
    padding: 0 22px;
    text-align: center;
    pointer-events: none;
    opacity: 0;
    transform: translateY(6px);
    transition:
        opacity 0.3s 0.2s,
        transform 0.3s 0.2s;
`;

const wrapVisible = css`
    opacity: 1;
    transform: none;
`;

const captionIn = keyframes`
    from {
        opacity: 0;
    }
`;

const fadeIn = css`
    animation: ${captionIn} 0.22s ease-out;
`;

const route = css`
    font-family: 'Outfit', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.6px;
    color: #0ea5e9;
`;

const title = css`
    margin: 5px 0 2px;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const draftBadge = css`
    display: inline-block;
    margin-left: 6px;
    padding: 2px 7px;
    border-radius: 999px;
    background: #fef3c7;
    color: #b45309;
    font-size: 10px;
    font-weight: 700;
    vertical-align: 2px;
`;

const date = css`
    font-family: 'Outfit', sans-serif;
    font-size: 11.5px;
    font-weight: 500;
    color: #94a3b8;
`;

const dots = css`
    margin-top: 10px;
    display: flex;
    justify-content: center;
    gap: 6px;
`;

const dot = css`
    width: 6px;
    height: 6px;
    border-radius: 3px;
    background: #cbd5e1;
    transition:
        width 0.25s,
        background 0.25s;
`;

const dotOn = css`
    width: 18px;
    background: #0ea5e9;
`;

const counter = css`
    margin-top: 10px;
    font-family: 'Outfit', sans-serif;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #0f172a;
    span {
        color: #cbd5e1;
    }
`;

const hint = css`
    margin-top: 8px;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
`;
