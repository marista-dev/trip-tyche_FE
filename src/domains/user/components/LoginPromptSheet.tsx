import { css } from '@emotion/react';
import { Ticket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

    const { title, description } = COPY[reason];

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
            <p css={expiryNote}>게스트 체험 기록은 4시간 뒤 사라져요.</p>
        </SheetDialog>
    );
};

// 아이콘·체크 표시 없이 글 목록으로. 항목 사이는 얇은 구분선 대신 간격으로만 나눈다.
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
