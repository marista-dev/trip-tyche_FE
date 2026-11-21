/** 사용자 summary 쿼리 키. AuthProvider(메인 번들)가 가져다 쓰므로 useQuery가 든 queries.ts와 분리해 둔다 */
export const SUMMARY_QUERY_KEY = ['summary'];

/** 마이 페이지 통계 쿼리 키. 여행·사진이 바뀔 때 invalidateTripLists가 함께 무효화한다 */
export const userKeys = {
    stats: ['user-stats'] as const,
};
