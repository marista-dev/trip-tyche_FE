import { useEffect, useRef, useState } from 'react';

import { css } from '@emotion/react';
import { ChevronRight, Edit, Image, Lock, Share2, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

import { getIataFromCountryString } from '@/domains/trip/airport';
import { getDepartureCode } from '@/domains/trip/destinations';
import { COLORS } from '@/shared/constants/style';

interface ActionSheetTrip {
    tripTitle: string;
    country: string;
    coverPhoto?: string;
}

interface TripTicketActionSheetProps {
    open: boolean;
    onClose: () => void;
    trip: ActionSheetTrip;
    isOwner: boolean;
    isGuest: boolean;
    isCompletedTrip: boolean;
    handler: {
        edit: (isCompletedTrip: boolean) => void;
        images: () => void;
        delete: () => void;
    };
    onShare: () => void;
    /** 게스트가 잠긴 동작(공유·삭제)을 눌렀을 때. 로그인 유도 시트를 연다. */
    onLocked: (id: 'share' | 'delete') => void;
}

const TripTicketActionSheet = ({
    open,
    onClose,
    trip,
    isOwner,
    isGuest,
    isCompletedTrip,
    handler,
    onShare,
    onLocked,
}: TripTicketActionSheetProps) => {
    const [mounted, setMounted] = useState(false);
    const [show, setShow] = useState(false);
    const firstActionRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) {
            setMounted(true);
            requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
        } else if (mounted) {
            setShow(false);
            const t = setTimeout(() => setMounted(false), 260);
            return () => clearTimeout(t);
        }
    }, [open]);

    useEffect(() => {
        if (show) firstActionRef.current?.focus();
    }, [show]);

    useEffect(() => {
        if (!show) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [show, onClose]);

    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [show]);

    if (!mounted) return null;

    const destinationIata = getIataFromCountryString(trip.country);

    /*
     * 게스트의 체험용 여행은 소유자가 게스트 본인이다. 예전엔 '공유받은 티켓' 메뉴를 보여줘
     * '공유 해제'를 누르면 실제로는 여행 삭제(DELETE)가 나가 401 → 로그인 화면으로 튕겼다.
     * 보기는 열어두고, 쓰기는 자물쇠로 표시해 누르면 로그인을 안내한다.
     */
    const guestActions = [
        { id: 'edit', label: '정보 보기', sub: '제목, 날짜, 해시태그', Icon: Edit, tone: 'default' as const },
        { id: 'photo', label: '사진 보기', sub: '지도 위 사진과 날짜별 기록', Icon: Image, tone: 'default' as const },
        {
            id: 'share',
            label: '친구에게 공유',
            sub: '로그인하면 사용할 수 있어요',
            Icon: Share2,
            tone: 'default' as const,
            locked: true,
        },
        {
            id: 'delete',
            label: '여행 삭제',
            sub: '로그인하면 사용할 수 있어요',
            Icon: Trash2,
            tone: 'default' as const,
            locked: true,
        },
    ];

    const actions: {
        id: string;
        label: string;
        sub: string;
        Icon: typeof Edit;
        tone: 'default' | 'danger';
        locked?: boolean;
    }[] = isGuest
        ? guestActions
        : isOwner
          ? [
                {
                    id: 'edit',
                    label: '여행 정보 수정',
                    sub: '제목, 날짜, 해시태그',
                    Icon: Edit,
                    tone: 'default' as const,
                },
                {
                    id: 'photo',
                    label: '사진 관리',
                    sub: '추가 · 삭제 · 위치 수정',
                    Icon: Image,
                    tone: 'default' as const,
                },
                {
                    id: 'share',
                    label: '친구에게 공유',
                    sub: '링크 복사 또는 앱으로 보내기',
                    Icon: Share2,
                    tone: 'default' as const,
                },
                { id: 'delete', label: '여행 삭제', sub: '복구할 수 없어요', Icon: Trash2, tone: 'danger' as const },
            ]
          : [
                { id: 'edit', label: '정보 보기', sub: '제목, 날짜, 해시태그', Icon: Edit, tone: 'default' as const },
                {
                    id: 'photo',
                    label: '사진 보기',
                    sub: '추가 · 삭제 · 위치 수정',
                    Icon: Image,
                    tone: 'default' as const,
                },
                {
                    id: 'share',
                    label: '공유 정보',
                    sub: '링크 복사 또는 앱으로 보내기',
                    Icon: Share2,
                    tone: 'default' as const,
                },
                {
                    id: 'delete',
                    label: '공유 해제',
                    sub: '이 티켓에 더 이상 접근할 수 없어요',
                    Icon: Trash2,
                    tone: 'danger' as const,
                },
            ];

    const handleAction = (id: string) => {
        onClose();
        if (isGuest && (id === 'share' || id === 'delete')) {
            onLocked(id);
            return;
        }
        if (id === 'edit') handler.edit(isCompletedTrip);
        if (id === 'photo') handler.images();
        if (id === 'share') onShare();
        if (id === 'delete') handler.delete();
    };

    const sheet = (
        <div
            css={css`
                position: fixed;
                inset: 0;
                z-index: 9999;
                pointer-events: ${show ? 'auto' : 'none'};
            `}
        >
            <div
                onClick={onClose}
                css={css`
                    position: absolute;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.45);
                    backdrop-filter: blur(4px);
                    opacity: ${show ? 1 : 0};
                    transition: opacity 260ms cubic-bezier(0.32, 0.72, 0, 1);
                `}
            />
            <div
                role='dialog'
                aria-modal='true'
                aria-label='여행 액션 메뉴'
                css={css`
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #fff;
                    border-radius: 20px 20px 0 0;
                    padding-bottom: 32px;
                    transform: ${show ? 'translateY(0)' : 'translateY(100%)'};
                    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
                    box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.2);
                    max-height: 75%;
                    overflow: auto;
                `}
            >
                {/* Handle */}
                <div
                    css={css`
                        display: flex;
                        justify-content: center;
                        padding: 10px 0 4px;
                    `}
                >
                    <div
                        css={css`
                            width: 40px;
                            height: 4px;
                            border-radius: 4px;
                            background: rgba(15, 23, 42, 0.12);
                        `}
                    />
                </div>

                {/* Trip preview header */}
                <div
                    css={css`
                        padding: 12px 20px 16px;
                        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    `}
                >
                    <div
                        css={css`
                            width: 44px;
                            height: 44px;
                            border-radius: 10px;
                            overflow: hidden;
                            flex-shrink: 0;
                            background: ${COLORS.BACKGROUND.GRAY};
                        `}
                    >
                        {trip.coverPhoto && (
                            <img
                                src={trip.coverPhoto}
                                alt=''
                                css={css`
                                    width: 100%;
                                    height: 100%;
                                    object-fit: cover;
                                `}
                            />
                        )}
                    </div>
                    <div
                        css={css`
                            min-width: 0;
                            flex: 1;
                        `}
                    >
                        <div
                            css={css`
                                font-size: 10px;
                                font-weight: 700;
                                letter-spacing: 1.5px;
                                text-transform: uppercase;
                                color: ${COLORS.PRIMARY};
                                margin-bottom: 3px;
                            `}
                        >
                            {getDepartureCode(trip.country)} → {destinationIata}
                        </div>
                        <div
                            css={css`
                                font-size: 15px;
                                font-weight: 700;
                                color: ${COLORS.TICKET_BAND};
                                letter-spacing: -0.2px;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                            `}
                        >
                            {trip.tripTitle}
                        </div>
                    </div>
                </div>

                {/* Action list */}
                <ul
                    css={css`
                        list-style: none;
                        margin: 0;
                        padding: 4px 0;
                    `}
                >
                    {actions.map((action, i) => {
                        const isDanger = action.tone === 'danger';
                        return (
                            <li key={action.id}>
                                {i === actions.length - 1 && (
                                    <div
                                        css={css`
                                            height: 1px;
                                            margin: 4px 20px;
                                            background: rgba(15, 23, 42, 0.06);
                                        `}
                                    />
                                )}
                                <button
                                    ref={i === 0 ? firstActionRef : undefined}
                                    onClick={() => handleAction(action.id)}
                                    css={css`
                                        width: 100%;
                                        border: none;
                                        background: none;
                                        padding: 14px 20px;
                                        display: flex;
                                        align-items: center;
                                        gap: 14px;
                                        cursor: pointer;
                                        text-align: left;
                                        -webkit-tap-highlight-color: transparent;

                                        &:hover,
                                        &:active {
                                            background: rgba(15, 23, 42, 0.04);
                                        }
                                    `}
                                >
                                    <div
                                        css={css`
                                            width: 38px;
                                            height: 38px;
                                            border-radius: 10px;
                                            background: ${isDanger
                                                ? 'rgba(239, 68, 68, 0.1)'
                                                : 'rgba(15, 23, 42, 0.05)'};
                                            color: ${isDanger ? '#ef4444' : COLORS.TICKET_BAND};
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            flex-shrink: 0;
                                        `}
                                    >
                                        <action.Icon size={18} strokeWidth={2} />
                                    </div>
                                    <div
                                        css={css`
                                            flex: 1;
                                            min-width: 0;
                                        `}
                                    >
                                        <div
                                            css={css`
                                                font-size: 14px;
                                                font-weight: 600;
                                                color: ${isDanger ? '#ef4444' : COLORS.TICKET_BAND};
                                                letter-spacing: -0.2px;
                                            `}
                                        >
                                            {action.label}
                                        </div>
                                        <div
                                            css={css`
                                                font-size: 11px;
                                                color: rgba(15, 23, 42, 0.5);
                                                margin-top: 1px;
                                            `}
                                        >
                                            {action.sub}
                                        </div>
                                    </div>
                                    {action.locked ? (
                                        <span
                                            aria-label='로그인 필요'
                                            css={css`
                                                display: inline-flex;
                                                align-items: center;
                                                gap: 3px;
                                                padding: 4px 8px;
                                                border-radius: 999px;
                                                background: ${COLORS.BACKGROUND.PRIMARY_LIGHT};
                                                color: ${COLORS.PRIMARY};
                                                font-size: 11px;
                                                font-weight: 700;
                                                flex-shrink: 0;
                                            `}
                                        >
                                            <Lock size={11} strokeWidth={2.5} aria-hidden='true' />
                                            로그인
                                        </span>
                                    ) : (
                                        !isDanger && (
                                            <ChevronRight size={16} strokeWidth={2} color='rgba(15, 23, 42, 0.25)' />
                                        )
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>

                {/* Cancel */}
                <div
                    css={css`
                        padding: 4px 16px 0;
                    `}
                >
                    <button
                        onClick={onClose}
                        css={css`
                            width: 100%;
                            padding: 14px 0;
                            border: none;
                            background: rgba(15, 23, 42, 0.04);
                            border-radius: 12px;
                            font-size: 14px;
                            font-weight: 600;
                            color: rgba(15, 23, 42, 0.6);
                            cursor: pointer;
                            -webkit-tap-highlight-color: transparent;

                            &:hover,
                            &:active {
                                background: rgba(15, 23, 42, 0.08);
                            }
                        `}
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(sheet, document.body);
};

export default TripTicketActionSheet;
