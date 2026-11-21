/** 공유 쿼리 키 */
export const shareKeys = {
    all: ['share'] as const,
    detail: (shareId: number) => ['share', shareId] as const,
};
