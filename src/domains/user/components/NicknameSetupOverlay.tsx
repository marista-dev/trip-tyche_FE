/* 첫 로그인(닉네임 없음) 때 지구본 위에 띄우는 닉네임 등록 오버레이 */
import { useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { useQueryClient } from '@tanstack/react-query';

import { NICKNAME_FORM } from '@/domains/user/constants';
import { useNickname } from '@/domains/user/hooks/useNickname';
import { validateUserNickName } from '@/libs/utils/validate';
import { COLORS } from '@/shared/constants/style';

const { ACCENT } = COLORS;

const NicknameSetupOverlay = () => {
    const queryClient = useQueryClient();
    const [nicknameInput, setNicknameInput] = useState('');
    const nicknameValidation = validateUserNickName(nicknameInput, NICKNAME_FORM.MIN_LENGTH, NICKNAME_FORM.MAX_LENGTH);
    // 등록되면 summary를 다시 받아 오버레이가 닫힌다
    const {
        isSubmitting,
        error: nicknameError,
        submitNickname,
    } = useNickname(nicknameInput, () => queryClient.invalidateQueries({ queryKey: ['summary'] }));

    return (
        <div css={nicknameOverlay}>
            <div css={nicknameCard}>
                <div css={nicknameCardEmoji}>✈️</div>
                <h2 css={nicknameCardTitle}>트립티케에 오신 걸 환영해요!</h2>
                <p css={nicknameCardSub}>여행 티켓에 표시될 닉네임을 정해주세요</p>

                <div css={nicknameInputWrap(nicknameValidation.valid || !nicknameInput)}>
                    <input
                        css={nicknameInputField}
                        type='text'
                        placeholder='닉네임 입력'
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        maxLength={NICKNAME_FORM.MAX_LENGTH + 1}
                        autoFocus
                    />
                </div>

                {nicknameInput && !nicknameValidation.valid && (
                    <p css={nicknameErrorMsg}>{nicknameValidation.message}</p>
                )}
                {nicknameError && <p css={nicknameErrorMsg}>{nicknameError}</p>}

                <div css={nicknameSuggestions}>
                    {NICKNAME_FORM.SUGGESTIONS.slice(0, 4).map((s) => (
                        <button key={s} css={nicknameSuggestionChip} onClick={() => setNicknameInput(s)}>
                            {s}
                        </button>
                    ))}
                </div>

                <button
                    css={nicknameSubmitBtn(nicknameValidation.valid && !!nicknameInput && !isSubmitting)}
                    disabled={!nicknameValidation.valid || !nicknameInput || isSubmitting}
                    onClick={submitNickname}
                >
                    {isSubmitting ? '처리 중...' : '닉네임 등록하기'}
                </button>
            </div>
        </div>
    );
};

export default NicknameSetupOverlay;

const fadeIn = keyframes`
    from { opacity: 0; }
    to   { opacity: 1; }
`;

const cardUp = keyframes`
    from { transform: translateY(24px) scale(0.94); opacity: 0; }
    to   { transform: translateY(0)    scale(1);    opacity: 1; }
`;

/* nickname overlay */
const nicknameOverlay = css`
    position: absolute;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    animation: ${fadeIn} 0.3s ease both;
`;

const nicknameCard = css`
    width: 100%;
    max-width: 340px;
    background: #fff;
    border-radius: 24px;
    padding: 28px 24px 24px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: ${cardUp} 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
`;

const nicknameCardEmoji = css`
    font-size: 36px;
    margin-bottom: 12px;
`;

const nicknameCardTitle = css`
    font-size: 17px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.4px;
    margin-bottom: 6px;
    text-align: center;
`;

const nicknameCardSub = css`
    font-size: 13px;
    color: #64748b;
    text-align: center;
    margin-bottom: 20px;
    line-height: 1.5;
`;

const nicknameInputWrap = (valid: boolean) => css`
    width: 100%;
    border: 1.5px solid ${valid ? '#e2e8f0' : COLORS.TEXT.ERROR};
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 8px;
    transition: border-color 0.2s;
    &:focus-within {
        border-color: ${valid ? ACCENT : COLORS.TEXT.ERROR};
    }
`;

const nicknameInputField = css`
    width: 100%;
    padding: 12px 14px;
    font-size: 15px;
    font-weight: 500;
    border: none;
    outline: none;
    font-family: inherit;
    color: #0f172a;
    &::placeholder {
        color: #94a3b8;
    }
`;

const nicknameErrorMsg = css`
    font-size: 12px;
    color: ${COLORS.TEXT.ERROR};
    align-self: flex-start;
    margin-bottom: 8px;
`;

const nicknameSuggestions = css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
    margin-bottom: 20px;
`;

const nicknameSuggestionChip = css`
    padding: 6px 12px;
    background: #f1f5f9;
    border: none;
    border-radius: 100px;
    font-size: 12px;
    color: #475569;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    &:hover {
        background: #e2e8f0;
    }
`;

const nicknameSubmitBtn = (active: boolean) => css`
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: none;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: ${active ? 'pointer' : 'not-allowed'};
    background: ${active ? ACCENT : '#cbd5e1'};
    color: #fff;
    transition:
        background 0.2s,
        transform 0.1s;
    &:active {
        transform: ${active ? 'scale(0.98)' : 'none'};
    }
`;
