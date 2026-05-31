export const NICKNAME_FORM = {
    MIN_LENGTH: 2,
    MAX_LENGTH: 10,
    SUGGESTIONS: ['여행자', '탐험가', '노마드', '글로버트로터'],
};

/**
 * 설정 페이지 닉네임 중앙 다이얼로그(NicknameDialog) 전용 규칙.
 * 가입/생성 플로우의 NICKNAME_FORM(2~10자)과 분리해 SettingPage 수정 경로에만 적용한다.
 * 디자인 핸드오프 기준: 2~12자, 한글/영문/숫자/_ 허용.
 */
export const NICKNAME_RULE = {
    MIN_LENGTH: 2,
    MAX_LENGTH: 12,
    /** 허용 외 문자(한글/영문/숫자/_ 가 아닌 문자)를 찾는 패턴 */
    INVALID_CHAR: /[^가-힣a-zA-Z0-9_]/,
} as const;
