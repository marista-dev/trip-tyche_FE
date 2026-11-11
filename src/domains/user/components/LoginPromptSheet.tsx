import { css } from '@emotion/react';
import { Check, Clock, ImagePlus, LucideIcon, PencilLine, Share2, Ticket, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { LoginPromptReason, useLoginPromptStore } from '@/domains/user/stores/useLoginPromptStore';
import useUserStore from '@/domains/user/stores/useUserStore';
import BottomSheet from '@/shared/components/common/BottomSheet';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';

const COPY: Record<LoginPromptReason, { Icon: LucideIcon; title: string; description: string }> = {
    photo: {
        Icon: ImagePlus,
        title: '사진을 올리려면 로그인이 필요해요',
        description: '내 사진의 위치와 날짜로 지도 위에 여행 경로를 그려드려요.',
    },
    trip: {
        Icon: Ticket,
        title: '나만의 여행 티켓을 만들어보세요',
        description: '로그인하면 티켓을 발권하고 사진으로 여행을 기록할 수 있어요.',
    },
    edit: {
        Icon: PencilLine,
        title: '저장하려면 로그인이 필요해요',
        description: '게스트 모드에서는 둘러보기만 할 수 있어요.',
    },
    profile: {
        Icon: UserRound,
        title: '나만의 닉네임을 정해보세요',
        description: '로그인하면 프로필을 꾸미고 친구가 나를 찾을 수 있어요.',
    },
    share: {
        Icon: Share2,
        title: '친구와 여행을 함께 보려면',
        description: '로그인하면 닉네임으로 친구를 찾아 티켓을 공유할 수 있어요.',
    },
    delete: {
        Icon: Trash2,
        title: '체험용 여행은 삭제할 수 없어요',
        description: '로그인하면 내 여행을 자유롭게 만들고 정리할 수 있어요.',
    },
};

const BENEFITS = ['내 사진으로 여행 경로 자동 기록', '친구와 티켓 공유', '기록은 계속 보관'];

/**
 * 게스트가 회원 전용 동작을 시도했을 때 뜨는 로그인 유도 시트.
 * RootLayout에 하나만 마운트하고 useLoginPromptStore로 연다.
 */
const LoginPromptSheet = () => {
    const isOpen = useLoginPromptStore((s) => s.isOpen);
    const reason = useLoginPromptStore((s) => s.reason);
    const close = useLoginPromptStore((s) => s.close);
    const logout = useUserStore((s) => s.logout);
    const navigate = useNavigate();

    const { Icon, title, description } = COPY[reason];

    const goToSignin = () => {
        close();
        /*
         * 로그인 화면은 이미 인증된 사용자를 막지 않으므로 먼저 이동한다.
         * 게스트 세션을 끊는 건 그다음 — 순서를 바꾸면 RequireAuth가 state 없이 먼저 리다이렉트해
         * 로그인 버튼 단계(step 1)가 아니라 소개 화면으로 떨어진다.
         */
        navigate(ROUTES.PATH.SIGNIN, { replace: true, state: { step: 1 } });
        void logout();
    };

    return (
        <BottomSheet isOpen={isOpen} onClose={close}>
            <div css={body}>
                <div css={stub}>
                    <span css={stubIcon}>
                        <Icon size={22} strokeWidth={2} />
                    </span>
                    <span css={passLabel}>GUEST PASS</span>
                </div>

                <h2 css={titleStyle}>{title}</h2>
                <p css={descriptionStyle}>{description}</p>

                <ul css={benefitList}>
                    {BENEFITS.map((benefit) => (
                        <li key={benefit} css={benefitItem}>
                            <span css={checkMark}>
                                <Check size={12} strokeWidth={3} />
                            </span>
                            {benefit}
                        </li>
                    ))}
                </ul>

                <p css={expiryNote}>
                    <Clock size={13} strokeWidth={2.2} aria-hidden='true' />
                    게스트 체험 기록은 4시간 뒤 사라져요
                </p>

                <button type='button' css={primaryButton} onClick={goToSignin}>
                    로그인하고 시작하기
                </button>
                <button type='button' css={secondaryButton} onClick={close}>
                    계속 둘러볼게요
                </button>
            </div>
        </BottomSheet>
    );
};

const body = css`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 4px 4px 0;
`;

const stub = css`
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px 8px 8px;
    margin-bottom: 18px;
    border-radius: 14px;
    background: ${COLORS.BACKGROUND.PRIMARY_LIGHT};

    /* 탑승권 절취선 느낌의 양옆 노치 */
    &::before,
    &::after {
        content: '';
        position: absolute;
        top: 50%;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ffffff;
        transform: translateY(-50%);
    }
    &::before {
        left: -5px;
    }
    &::after {
        right: -5px;
    }
`;

const stubIcon = css`
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: ${COLORS.PRIMARY};
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const passLabel = css`
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.8px;
    color: ${COLORS.PRIMARY};
`;

const titleStyle = css`
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.4px;
    line-height: 1.35;
    color: ${COLORS.TICKET_BAND};
    word-break: keep-all;
`;

const descriptionStyle = css`
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.5;
    color: rgba(15, 23, 42, 0.6);
    word-break: keep-all;
`;

const benefitList = css`
    list-style: none;
    margin: 20px 0 0;
    padding: 14px 16px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.03);
    text-align: left;
`;

const benefitItem = css`
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 500;
    color: ${COLORS.TICKET_BAND};
`;

const checkMark = css`
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(0, 113, 227, 0.12);
    color: ${COLORS.PRIMARY};
    display: flex;
    align-items: center;
    justify-content: center;
`;

const expiryNote = css`
    margin: 14px 0 18px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: rgba(15, 23, 42, 0.45);
`;

const primaryButton = css`
    width: 100%;
    height: 52px;
    border: none;
    border-radius: 14px;
    background: ${COLORS.PRIMARY};
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.2px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s ease;

    @media (hover: hover) {
        &:hover {
            background: ${COLORS.PRIMARY_HOVER};
        }
    }
    &:active {
        transform: scale(0.99);
    }
`;

const secondaryButton = css`
    width: 100%;
    height: 44px;
    margin-top: 6px;
    border: none;
    background: none;
    color: rgba(15, 23, 42, 0.5);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
`;

export default LoginPromptSheet;
