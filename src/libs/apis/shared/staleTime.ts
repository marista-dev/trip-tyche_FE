/** 쿼리 기본 staleTime(5분). TanStackProvider의 전역 기본값으로도 쓴다 */
export const QUERY_STALE_TIME = 5 * 60 * 1000;

/**
 * toResult 기반 queryFn은 실패도 에러가 아닌 값(success: false)으로 돌려줘서 React Query가 재시도하지 않는다.
 * 그대로 두면 실패 결과가 staleTime 동안 캐시에 남으므로, 성공했을 때만 fresh로 보고 실패는 바로 낡게 한다.
 */
export const staleOnlyOnSuccess = (query: { state: { data?: { success: boolean } } }) =>
    query.state.data?.success ? QUERY_STALE_TIME : 0;
