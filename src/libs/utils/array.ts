/** size개씩 자른다. 요청당 개수 상한이 있는 API에 나눠 보낼 때 쓴다. */
export const chunk = <T>(items: readonly T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
