/** 여행 경로(지도 핀) 쿼리 키 */
export const routeKeys = {
    all: ['route'] as const,
    detail: (tripKey: string) => ['route', tripKey] as const,
};
