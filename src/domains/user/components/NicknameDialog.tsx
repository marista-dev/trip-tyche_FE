import { useEffect, useRef, useState } from 'react';

import { css, keyframes } from '@emotion/react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { NICKNAME_RULE } from '@/domains/user/constants';
import { useNickname } from '@/domains/user/hooks/useNickname';
import { userAPI } from '@/libs/apis';
import { toResult } from '@/libs/apis/shared/utils';
import { COLORS } from '@/shared/constants/style';
import { useToastStore } from '@/shared/stores/useToastStore';

type DuplicateState = 'idle' | 'checking' | 'available' | 'taken';
const DUP_CHECK_DEBOUNCE_MS = 400;

interface NicknameDialogProps {
    /** 현재 닉네임 (변경 여부 판단 및 초기값) */
    current: string;
    onClose: () => void;
}

const { MIN_LENGTH, MAX_LENGTH, INVALID_CHAR } = NICKNAME_RULE;

/**
 * 설정 페이지 닉네임 수정 중앙 다이얼로그.
 * - 디자인 핸드오프(setting-final.jsx의 NicknameDialog) 이식: 입력 + 글자수 + 클리어 + 가이드 체크리스트.
 * - 저장은 기존 useNickname(중복체크 → PATCH → store.updateNickname)을 재사용한다.
 * - 중복 여부는 입력 디바운스로 실시간 검사(체크리스트 (c))하며, 저장 시 useNickname이 최종 검증한다.
 */
const NicknameDialog = ({ current, onClose }: NicknameDialogProps) => {
    const [name, setName] = useState(current);
    const inputRef = useRef<HTMLInputElement>(null);

    const queryClient = useQueryClient();
    const showToast = useToastStore((state) => state.showToast);

    const trimmed = name.trim();
    const empty = trimmed.length === 0;
    const tooShort = trimmed.length > 0 && trimmed.length < MIN_LENGTH;
    const tooLong = trimmed.length > MAX_LENGTH;
    const invalid = trimmed.length > 0 && INVALID_CHAR.test(trimmed);
    const changed = trimmed !== current;

    let errorMessage: string | null = null;
    if (tooShort) errorMessage = `${MIN_LENGTH}자 이상 입력해주세요`;
    else if (tooLong) errorMessage = `${MAX_LENGTH}자 이하로 입력해주세요`;
    else if (invalid) errorMessage = '한글, 영문, 숫자, _만 사용할 수 있어요';

    const { isSubmitting, error, submitNickname } = useNickname(trimmed, handleSuccess);
    const canSave = changed && !empty && !errorMessage && !isSubmitting;

    const lengthOk = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH;
    const charsetOk = trimmed.length > 0 && !invalid;
    const clientValid = changed && !empty && !errorMessage;

    // 길이/charset 통과 + 값이 바뀐 경우에만 서버 중복 검사를 디바운스로 실행(체크리스트 (c) 실시간 반영).
    // 저장 경로의 useNickname이 최종 권위를 가지므로 canSave는 이 상태에 종속시키지 않는다(네트워크 실패로 인한 저장 불능 방지).
    const [dupState, setDupState] = useState<DuplicateState>('idle');
    useEffect(() => {
        if (!clientValid) {
            setDupState('idle');
            return;
        }
        let cancelled = false;
        setDupState('checking');
        const timer = setTimeout(async () => {
            const result = await toResult(() => userAPI.checkNicknameDuplication(trimmed));
            if (!cancelled) setDupState(result.success ? 'available' : 'taken');
        }, DUP_CHECK_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [trimmed, clientValid]);

    function handleSuccess() {
        queryClient.invalidateQueries({ queryKey: ['ticket-list'] });
        queryClient.invalidateQueries({ queryKey: ['summary'] });
        showToast('닉네임이 변경되었습니다');
        onClose();
    }

    // 저장 시 서버에서 내려온 에러(중복 등)를 토스트로 노출
    useEffect(() => {
        if (error) showToast(error);
    }, [error, showToast]);

    const rules = [
        { ok: lengthOk, text: `${MIN_LENGTH}~${MAX_LENGTH}자 이내` },
        { ok: charsetOk, text: '한글, 영문, 숫자, _ 만 사용' },
        { ok: dupState === 'available', text: '중복되지 않는 닉네임' },
    ];

    let helperText = ' ';
    let helperColor = 'transparent';
    if (errorMessage) {
        helperText = errorMessage;
        helperColor = '#dc2626';
    } else if (dupState === 'taken') {
        helperText = '이미 사용 중인 닉네임이에요';
        helperColor = '#dc2626';
    } else if (dupState === 'checking') {
        helperText = '중복 확인 중…';
        helperColor = '#888';
    } else if (dupState === 'available') {
        helperText = '사용 가능한 닉네임이에요';
        helperColor = '#16a34a';
    }

    return createPortal(
        <div css={layer}>
            <div css={overlay} onClick={onClose} aria-hidden='true' />
            <div css={dialog} role='dialog' aria-modal='true' aria-label='닉네임 수정'>
                <div css={body}>
                    <p css={title}>닉네임 수정</p>
                    <p css={subtitle}>새 닉네임을 입력해주세요</p>

                    <div css={inputRow(Boolean(errorMessage))}>
                        <input
                            ref={inputRef}
                            css={inputStyle}
                            value={name}
                            autoFocus
                            maxLength={MAX_LENGTH + 4}
                            onChange={(event) => setName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && canSave) submitNickname();
                            }}
                        />
                        <span css={counter(tooLong)}>
                            {trimmed.length}/{MAX_LENGTH}
                        </span>
                        {name.length > 0 && (
                            <button
                                css={clearButton}
                                onClick={() => {
                                    setName('');
                                    inputRef.current?.focus();
                                }}
                                aria-label='입력 지우기'
                            >
                                <X size={11} color='#fff' strokeWidth={3} />
                            </button>
                        )}
                    </div>

                    <p css={helper(helperColor)}>{helperText}</p>

                    <div css={checklist}>
                        {rules.map((rule, index) => (
                            <div key={rule.text} css={ruleRow(index === 0)}>
                                <div css={ruleMark(rule.ok)}>
                                    <Check size={9} color={rule.ok ? '#fff' : 'rgba(0,0,0,0.3)'} strokeWidth={3.4} />
                                </div>
                                <span css={ruleText(rule.ok)}>{rule.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div css={footer}>
                    <button css={[footerButton, cancelButton]} onClick={onClose}>
                        취소
                    </button>
                    <button css={[footerButton, saveButton(canSave)]} disabled={!canSave} onClick={submitNickname}>
                        {isSubmitting ? '저장 중…' : '저장'}
                    </button>
                </div>
            </div>
        </div>,
        document.getElementById('portal-root') || document.body,
    );
};

export default NicknameDialog;

/* ════════════ styles ════════════ */
const fade = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const pop = keyframes`
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.88); }
    100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

const layer = css`
    position: fixed;
    inset: 0;
    z-index: 1200;
    font-family:
        'Outfit',
        -apple-system,
        'SF Pro Text',
        sans-serif;
`;

const overlay = css`
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: ${fade} 200ms ease-out;
    cursor: pointer;
`;

const dialog = css`
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(304px, calc(100vw - 48px));
    background: rgba(255, 255, 255, 0.99);
    backdrop-filter: blur(20px);
    border-radius: 22px;
    overflow: hidden;
    box-shadow:
        0 24px 60px rgba(0, 0, 0, 0.28),
        0 0 0 1px rgba(0, 0, 0, 0.04);
    animation: ${pop} 280ms cubic-bezier(0.34, 1.56, 0.64, 1);

    @media (prefers-reduced-motion: reduce) {
        animation: none;
    }
`;

const body = css`
    padding: 22px 20px 16px;
`;

const title = css`
    margin: 0;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.3px;
`;

const subtitle = css`
    margin: 4px 0 0;
    text-align: center;
    font-size: 12px;
    color: #888;
`;

const inputRow = (hasError: boolean) => css`
    margin-top: 16px;
    background: #f4f4f5;
    border-radius: 11px;
    border: 1.5px solid ${hasError ? 'rgba(220, 38, 38, 0.45)' : `${COLORS.PRIMARY}73`};
    padding: 11px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: border-color 0.15s ease;
`;

const inputStyle = css`
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-family: inherit;
    font-size: 16px;
    font-weight: 600;
    color: #111;
    letter-spacing: -0.2px;
`;

const counter = (over: boolean) => css`
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${over ? '#dc2626' : '#aaa'};
`;

const clearButton = css`
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.2);
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
`;

const helper = (color: string) => css`
    min-height: 15px;
    margin: 6px 0 0;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: ${color};
`;

const checklist = css`
    margin-top: 6px;
    padding: 12px 14px;
    background: #f8f9fb;
    border-radius: 12px;
`;

const ruleRow = (first: boolean) => css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: ${first ? 0 : 7}px;
`;

const ruleMark = (ok: boolean) => css`
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${ok ? '#16a34a' : 'rgba(0, 0, 0, 0.1)'};
    display: grid;
    place-items: center;
    flex-shrink: 0;
    transition: background 150ms ease;
`;

const ruleText = (ok: boolean) => css`
    font-size: 12px;
    color: ${ok ? '#111' : '#888'};
    font-weight: ${ok ? 600 : 500};
`;

const footer = css`
    display: flex;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
`;

const footerButton = css`
    flex: 1;
    padding: 14px 0;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 15px;
    cursor: pointer;
`;

const cancelButton = css`
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    font-weight: 500;
    color: #111;
`;

const saveButton = (active: boolean) => css`
    font-weight: 700;
    color: ${active ? COLORS.PRIMARY : 'rgba(0, 0, 0, 0.25)'};
    cursor: ${active ? 'pointer' : 'default'};
`;
