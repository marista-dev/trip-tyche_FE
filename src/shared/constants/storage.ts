/**
 * sessionStorage 키 단일 출처.
 * raw 문자열이 여러 파일에 흩어지면 오타로 인한 키 불일치를 추적할 수 없어 상수로 모은다.
 */
export const STORAGE_KEYS = {
    /** 시네마틱 경로 재생을 위해 직렬화한 이미지 날짜 배열 */
    IMAGE_DATES: 'imageDates',
    /** 시네마틱 경로 애니메이션 재개 인덱스 */
    CINEMATIC_RESUME_IDX: 'cinematicResumeIdx',
} as const;
