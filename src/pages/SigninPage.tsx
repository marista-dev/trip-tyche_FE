import { useState } from 'react';

import { css } from '@emotion/react';

import backgroundImage from '@/assets/images/background-mobile.webp';
import GuestButton from '@/domains/user/components/GuestButton';
import LoginButton from '@/domains/user/components/LoginButton';
import useUserStore from '@/domains/user/stores/useUserStore';
import { API_BASE_URL, OAUTH_CONFIG } from '@/libs/apis/shared/constants';
import { isNative } from '@/platform';
import { saveAccessToken } from '@/platform/native/auth';
import { ROUTES } from '@/shared/constants/route';
import { COLORS } from '@/shared/constants/style';
import { useToastStore } from '@/shared/stores/useToastStore';

type Step = 0 | 1;

const SigninPage = () => {
    const [step, setStep] = useState<Step>(0);
    const loginAsGuest = useUserStore((s) => s.loginAsGuest);
    const showToast = useToastStore((s) => s.showToast);

    const handleLoginButtonClick = (provider: keyof typeof OAUTH_CONFIG.PATH) => {
        window.location.href = OAUTH_CONFIG.PATH[provider];
    };

    const handleGuestClick = async () => {
        try {
            await loginAsGuest();
            window.location.replace(ROUTES.PATH.HOME);
        } catch {
            showToast('게스트 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
    };

    const handleDevLogin = async () => {
        try {
            // API 주소를 하드코딩하지 않는다 — 에뮬레이터에서 localhost는 호스트가 아니라 기기 자신이다.
            const res = await fetch(`${API_BASE_URL}/v1/auth/test-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'test@test.com', provider: 'google' }),
            });
            const json = await res.json();
            const token = json?.data?.accessToken;
            if (!token) {
                console.error('[DEV] accessToken not found in response', json);
                return;
            }

            // 앱은 쿠키가 유지되지 않으므로 토큰 저장소를 쓴다. 웹은 기존 쿠키 방식 그대로.
            if (isNative()) {
                await saveAccessToken(token);
            } else {
                document.cookie = `access_token=${token}; path=/`;
            }

            window.location.replace(ROUTES.PATH.HOME);
        } catch (e) {
            console.error('[DEV] login failed:', e);
        }
    };

    return (
        <main css={wrap}>
            {/* ── Step 1 · Hero ── */}
            <section css={[frame, step === 0 ? frameOn : frameOff]} aria-hidden={step !== 0}>
                <img src={backgroundImage} css={heroBg} alt='' aria-hidden='true' />
                <div css={heroGrad} aria-hidden='true' />
                <div css={heroInner}>
                    <div css={brandRow}>
                        <span css={brandMark} aria-hidden='true'>
                            <svg width='12' height='12' viewBox='0 0 24 24' fill='#fff'>
                                <path d='M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z' />
                            </svg>
                        </span>
                        <span css={brandText}>TRIPTYCHE</span>
                    </div>

                    <div css={heroCopy}>
                        <p css={eyebrow}>여행의 기억을 담다</p>
                        <h1 css={h1}>
                            사진 한 장으로
                            <br />
                            그려지는
                            <br />
                            나만의 여행 지도
                        </h1>
                        <p css={lede}>
                            찍는 순간마다 자동 완성되는 여행 티켓.
                            <br />
                            위치, 날짜, 경로를 모두 담아드려요.
                        </p>
                        <button type='button' css={cta} onClick={() => setStep(1)} aria-label='로그인 화면으로 이동'>
                            지금 시작하기
                            <svg
                                width='14'
                                height='14'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth='2.5'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            >
                                <path d='M5 12h14M13 5l7 7-7 7' />
                            </svg>
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Step 2 · Auth ── */}
            <section css={[frame, step === 1 ? frameOn : frameOff]} aria-hidden={step !== 1}>
                <img src={backgroundImage} css={authBg} alt='' aria-hidden='true' />
                <div css={authOvl} aria-hidden='true' />
                <div css={authInner}>
                    <button type='button' css={backBtn} onClick={() => setStep(0)} aria-label='이전 화면으로'>
                        <svg
                            width='18'
                            height='18'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='#fff'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        >
                            <polyline points='15 18 9 12 15 6' />
                        </svg>
                    </button>

                    <div css={authBody}>
                        <p css={authEyebrow}>환영합니다</p>
                        <h2 css={h2}>
                            간편하게
                            <br />
                            시작해보세요
                        </h2>

                        <div css={btnStack}>
                            <LoginButton provider='kakao' onClick={() => handleLoginButtonClick('KAKAO')} />
                            <LoginButton provider='google' onClick={() => handleLoginButtonClick('GOOGLE')} />

                            <div css={divider} aria-hidden='true'>
                                <span css={dividerLine} />
                                <span css={dividerText}>또는</span>
                                <span css={dividerLine} />
                            </div>

                            <GuestButton onClick={handleGuestClick} />

                            {import.meta.env.DEV && (
                                <button type='button' css={devBtn} onClick={handleDevLogin}>
                                    DEV 로그인
                                </button>
                            )}
                        </div>

                        <p css={fineprint}>
                            계속 진행하면 <span css={underline}>이용약관</span>과{' '}
                            <span css={underline}>개인정보처리방침</span>에 동의하게 됩니다.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default SigninPage;

/* ════════════════════════════════════════════
   STYLES
════════════════════════════════════════════ */

const wrap = css`
    position: relative;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    font-family: -apple-system, 'SF Pro Text', 'Apple SD Gothic Neo', 'Pretendard', sans-serif;
    background: #0b1220;
`;

const frame = css`
    position: absolute;
    inset: 0;
    transition: opacity 360ms ease;

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;
const frameOn = css`
    opacity: 1;
    pointer-events: auto;
`;
const frameOff = css`
    opacity: 0;
    pointer-events: none;
`;

/* ── Step 1 · Hero ── */
const heroBg = css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(0.7) contrast(1.05) saturate(1.1);
`;

const heroGrad = css`
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0, 5, 20, 0.15) 0%, rgba(0, 5, 20, 0.75) 70%, rgba(0, 5, 20, 0.92) 100%);
`;

const heroInner = css`
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 88px 28px 44px;
`;

const brandRow = css`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const brandMark = css`
    width: 22px;
    height: 22px;
    border-radius: 7px;
    background: ${COLORS.PRIMARY};
    display: flex;
    align-items: center;
    justify-content: center;
`;

const brandText = css`
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: #ffffff;
`;

const heroCopy = css`
    margin-top: auto;
`;

const eyebrow = css`
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
    margin: 0 0 14px;
`;

const h1 = css`
    font-size: 40px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: #ffffff;
    margin: 0 0 18px;
    text-shadow: 0 4px 32px rgba(0, 0, 0, 0.3);
`;

const lede = css`
    font-size: 13.5px;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.72);
    margin: 0 0 32px;
`;

const cta = css`
    width: 100%;
    height: 54px;
    border-radius: 100px;
    border: none;
    background: #ffffff;
    color: #0f172a;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.2px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;

    @media (hover: hover) {
        &:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
        }
    }
    &:active {
        transform: scale(0.98);
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

/* ── Step 2 · Auth ── */
const authBg = css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(0.38) contrast(1.05) saturate(0.9) blur(2px);
`;

const authOvl = css`
    position: absolute;
    inset: 0;
    background: linear-gradient(170deg, rgba(0, 5, 30, 0.72) 0%, rgba(0, 0, 10, 0.94) 100%);
`;

const authInner = css`
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 56px 24px 36px;
`;

const backBtn = css`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: background 0.2s ease;

    @media (hover: hover) {
        &:hover {
            background: rgba(255, 255, 255, 0.14);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

const authBody = css`
    margin-top: auto;
`;

const authEyebrow = css`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
    margin: 0 0 14px;
`;

const h2 = css`
    font-size: 32px;
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.03em;
    color: #ffffff;
    margin: 0 0 40px;
`;

const btnStack = css`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const divider = css`
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 4px 0;
`;

const dividerLine = css`
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.14);
`;

const dividerText = css`
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
`;

const fineprint = css`
    font-size: 11px;
    line-height: 1.6;
    margin: 24px 0 0;
    text-align: center;
    color: rgba(255, 255, 255, 0.42);
`;

const underline = css`
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
`;

const devBtn = css`
    width: 100%;
    height: 44px;
    border-radius: 100px;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    background: transparent;
    color: rgba(255, 255, 255, 0.35);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    cursor: pointer;
    transition:
        border-color 0.2s,
        color 0.2s;

    @media (hover: hover) {
        &:hover {
            border-color: rgba(255, 255, 255, 0.4);
            color: rgba(255, 255, 255, 0.6);
        }
    }
`;
