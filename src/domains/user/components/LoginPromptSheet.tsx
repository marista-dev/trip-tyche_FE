import { css } from '@emotion/react';
import { Ticket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { GUEST_TTL_HOURS } from '@/domains/user/guestPolicy';
import { LoginPromptReason, useLoginPromptStore } from '@/domains/user/stores/useLoginPromptStore';
import useUserStore from '@/domains/user/stores/useUserStore';
import SheetDialog from '@/shared/components/common/BottomSheet/SheetDialog';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';

const COPY: Record<LoginPromptReason, { title: string; description: string }> = {
    photo: {
        title: '사진을 올리려면 로그인이 필요해요',
        description: '내 사진의 위치와 날짜로 지도 위에 여행 경로를 그려드려요.',
    },
    trip: {
        title: '나만의 여행 티켓을 만들어보세요',
        description: '로그인하면 티켓을 발권하고 사진으로 여행을 기록할 수 있어요.',
    },
    edit: {
        title: '저장하려면 로그인이 필요해요',
        description: '게스트 모드에서는 둘러보기만 할 수 있어요.',
    },
    profile: {
        title: '나만의 닉네임을 정해보세요',
        description: '로그인하면 프로필을 꾸미고 친구가 나를 찾을 수 있어요.',
    },
    share: {
        title: '친구와 여행을 함께 보려면',
        description: '로그인하면 닉네임으로 친구를 찾아 티켓을 공유할 수 있어요.',
    },
    delete: {
        title: '체험용 여행은 삭제할 수 없어요',
        description: '로그인하면 내 여행을 자유롭게 만들고 정리할 수 있어요.',
    },
};

const BENEFITS = ['내 사진으로 여행 경로 자동 기록', '친구와 티켓 공유', '기록은 계속 보관'];

/** RootLayout에 하나만 두고 useLoginPromptStore로 연다. */
const LoginPromptSheet = () => {
    const isOpen = useLoginPromptStore((s) => s.isOpen);
    const reason = useLoginPromptStore((s) => s.reason);
    const close = useLoginPromptStore((s) => s.close);
    const logout = useUserStore((s) => s.logout);
    const navigate = useNavigate();

    const { title, description } = COPY[reason];

    const goToSignin = () => {
        close();
        // 이동 먼저, 로그아웃은 나중 — 반대면 RequireAuth가 state 없이 리다이렉트해 소개 화면으로 간다.
        navigate(ROUTES.PATH.SIGNIN, { replace: true, state: { step: 1 } });
        void logout();
    };

    return (
        <SheetDialog
            isOpen={isOpen}
            onClose={close}
            eyebrow={
                <>
                    <Ticket size={13} strokeWidth={2.4} aria-hidden='true' />
                    GUEST PASS
                </>
            }
            title={title}
            description={description}
            primary={{ label: '로그인하고 시작하기', onClick: goToSignin }}
            tertiary={{ label: '계속 둘러볼게요', onClick: close }}
        >
            <ul css={benefitList}>
                {BENEFITS.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                ))}
            </ul>
            <p css={expiryNote}>게스트 체험 기록은 {GUEST_TTL_HOURS}시간 뒤 사라져요.</p>
        </SheetDialog>
    );
};

const benefitList = css`
    list-style: none;
    margin: 0;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 14px;
    background: ${COLORS.SURFACE_SUBTLE};
    font-size: 14px;
    line-height: 1.4;
    color: ${COLORS.TEXT.BLACK};
`;

const expiryNote = css`
    margin: 10px 0 0;
    font-size: 13px;
    color: ${COLORS.TEXT.DESCRIPTION};
`;

export default LoginPromptSheet;
