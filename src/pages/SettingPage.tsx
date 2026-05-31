import { useEffect, useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { ChevronRight, FileText, Info, Lock, MessageCircle, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import character from '@/assets/images/character-icon.png';
import NicknameDialog from '@/domains/user/components/NicknameDialog';
import StatBottomSheet, { StatView } from '@/domains/user/components/setting/StatBottomSheet';
import { useUserStats } from '@/domains/user/hooks/useUserStats';
import useUserStore from '@/domains/user/stores/useUserStore';
import Header from '@/shared/components/common/Header';
import ConfirmModal from '@/shared/components/common/Modal/ConfirmModal';
import { APP_VERSION } from '@/shared/constants/app';
import { ROUTES } from '@/shared/constants/route';
import { MESSAGE } from '@/shared/constants/ui';
import { useToastStore } from '@/shared/stores/useToastStore';

const COMING_SOON = '준비 중인 기능이에요';

const SettingPage = () => {
    const [editing, setEditing] = useState(false);
    const [statView, setStatView] = useState<StatView | null>(null);
    const [isLogoutOpen, setIsLogoutOpen] = useState(false);

    const nickname = useUserStore((state) => state.userInfo?.nickname);
    const isGuest = useUserStore((state) => state.isGuest);
    const logout = useUserStore((state) => state.logout);
    const showToast = useToastStore((state) => state.showToast);

    const navigate = useNavigate();
    const { stats, isLoading, isError } = useUserStats();

    useEffect(() => {
        if (!document.getElementById('outfit-font')) {
            const link = document.createElement('link');
            link.id = 'outfit-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap';
            document.head.appendChild(link);
        }
    }, []);

    const confirmLogout = () => {
        setIsLogoutOpen(false);
        logout();
    };

    const comingSoon = () => showToast(COMING_SOON);

    // 로드 실패 시 '0'을 보여주면 '데이터 없음'과 구분되지 않으므로 '–'로 표시한다.
    const displayStat = (value: number, needsMedia = false) =>
        isError || (needsMedia && isLoading) ? '–' : String(value);
    const statItems: { id: StatView; label: string; value: string }[] = [
        { id: 'trips', label: '여행', value: displayStat(stats.tripsCount) },
        { id: 'photos', label: '사진', value: displayStat(stats.totalPhotos, true) },
        { id: 'countries', label: '국가', value: displayStat(stats.countriesCount) },
    ];

    return (
        <div css={pageContainer}>
            <Header title='설정' isBackButton onBack={() => navigate(ROUTES.PATH.TICKETS)} />

            <main css={mainStyle}>
                {/* ── Profile card (flat) ── */}
                <section css={profileCard}>
                    <div css={profileRow}>
                        <div css={avatarRing}>
                            <img css={characterImg} src={character} alt='캐릭터' />
                        </div>
                        <div css={profileText}>
                            <p css={travelerLabel}>TRAVELER</p>
                            <p css={nicknameText}>{nickname ?? '여행자'}</p>
                        </div>
                        {!isGuest && (
                            <button css={editButton} onClick={() => setEditing(true)} aria-label='닉네임 수정'>
                                <Pencil size={16} />
                            </button>
                        )}
                    </div>

                    <div css={statDivider} />

                    <div css={statRow}>
                        {statItems.map((item, index) => (
                            <div css={statCell} key={item.id}>
                                <button css={statButton} onClick={() => setStatView(item.id)}>
                                    <span css={statValue}>{item.value}</span>
                                    <span css={statLabel}>{item.label}</span>
                                </button>
                                {index < statItems.length - 1 && <div css={statSeparator} />}
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── 계정 ── */}
                <h3 css={sectionTitle}>계정</h3>
                <ul css={cardGroup}>
                    <SettingRow icon={<MessageCircle size={18} />} label='문의하기' onClick={comingSoon} />
                </ul>

                {/* ── 앱 ── */}
                <h3 css={sectionTitle}>앱</h3>
                <ul css={cardGroup}>
                    <SettingRow icon={<FileText size={18} />} label='이용약관' onClick={comingSoon} />
                    <SettingRow icon={<Lock size={18} />} label='개인정보 처리방침' onClick={comingSoon} />
                    <SettingRow icon={<Info size={18} />} label='버전' value={APP_VERSION} />
                </ul>

                <button css={logoutButton} onClick={() => setIsLogoutOpen(true)}>
                    로그아웃
                </button>
            </main>

            {editing && <NicknameDialog current={nickname ?? ''} onClose={() => setEditing(false)} />}

            <StatBottomSheet view={statView} stats={stats} onClose={() => setStatView(null)} />

            {isLogoutOpen && (
                <ConfirmModal
                    title={MESSAGE.LOGOUT_MODAL.TITLE}
                    description={MESSAGE.LOGOUT_MODAL.MESSAGE}
                    confirmText={MESSAGE.LOGOUT_MODAL.CONFIRM_TEXT}
                    cancelText={MESSAGE.LOGOUT_MODAL.CANCEL_TEXT}
                    confirmModal={confirmLogout}
                    closeModal={() => setIsLogoutOpen(false)}
                />
            )}
        </div>
    );
};

export default SettingPage;

/* ════════════ Row ════════════ */
interface SettingRowProps {
    icon: React.ReactNode;
    label: string;
    value?: string;
    onClick?: () => void;
}

const SettingRow = ({ icon, label, value, onClick }: SettingRowProps) => (
    <li css={rowStyle(Boolean(onClick))} onClick={onClick}>
        <span css={rowIcon}>{icon}</span>
        <span css={rowLabel}>{label}</span>
        {value && <span css={rowValue}>{value}</span>}
        {onClick && <ChevronRight size={15} color='#c7c7cc' strokeWidth={2.4} />}
    </li>
);

/* ════════════ styles ════════════ */
const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const pageContainer = css`
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #fafafa;
    font-family:
        'Outfit',
        -apple-system,
        'SF Pro Text',
        sans-serif;
    color: #111;
`;

const mainStyle = css`
    flex: 1;
    overflow-y: auto;
    padding: 20px 16px 32px;
    animation: ${fadeUp} 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
`;

/* ── profile card ── */
const profileCard = css`
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 18px;
    padding: 20px;
    margin-bottom: 4px;
`;

const profileRow = css`
    display: flex;
    align-items: center;
    gap: 16px;
`;

const avatarRing = css`
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fbcfe8 0%, #c4b5fd 100%);
    display: grid;
    place-items: center;
    flex-shrink: 0;
`;

const characterImg = css`
    width: 38px;
    height: 38px;
    object-fit: contain;
`;

const profileText = css`
    flex: 1;
    min-width: 0;
`;

const travelerLabel = css`
    margin: 0;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #94a3b8;
`;

const nicknameText = css`
    margin: 2px 0 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.4px;
    color: #111;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const editButton = css`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.04);
    color: #666;
    display: grid;
    place-items: center;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s ease;

    &:active {
        background: rgba(0, 0, 0, 0.08);
    }
`;

const statDivider = css`
    margin: 16px 0;
    height: 1px;
    background: rgba(0, 0, 0, 0.06);
`;

const statRow = css`
    display: flex;
    align-items: center;
`;

const statCell = css`
    flex: 1;
    display: flex;
    align-items: center;
`;

const statButton = css`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 2px 0;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
`;

const statValue = css`
    font-size: 18px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.3px;
    font-variant-numeric: tabular-nums;
`;

const statLabel = css`
    font-size: 10px;
    font-weight: 600;
    color: #888;
`;

const statSeparator = css`
    width: 1px;
    height: 28px;
    background: rgba(0, 0, 0, 0.06);
    flex-shrink: 0;
`;

/* ── section / card group ── */
const sectionTitle = css`
    margin: 20px 0 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #888;
`;

const cardGroup = css`
    list-style: none;
    margin: 0;
    padding: 0;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 14px;
    overflow: hidden;

    & > li + li {
        border-top: 1px solid rgba(0, 0, 0, 0.04);
    }
`;

const rowStyle = (clickable: boolean) => css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    cursor: ${clickable ? 'pointer' : 'default'};
    -webkit-tap-highlight-color: transparent;

    &:active {
        background: ${clickable ? '#fafafa' : 'transparent'};
    }
`;

const rowIcon = css`
    color: #666;
    display: grid;
    place-items: center;
`;

const rowLabel = css`
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: #111;
`;

const rowValue = css`
    font-size: 12px;
    color: #888;
    font-variant-numeric: tabular-nums;
`;

const logoutButton = css`
    margin-top: 24px;
    width: 100%;
    padding: 14px 0;
    background: transparent;
    border: 1px solid rgba(220, 38, 38, 0.2);
    border-radius: 12px;
    color: #dc2626;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s ease;

    &:active {
        background: rgba(220, 38, 38, 0.04);
    }
`;
