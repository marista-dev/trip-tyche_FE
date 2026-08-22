import { describe, it, expect } from 'vitest';

import { runWithPool } from './async';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('runWithPool', () => {
    it('동시 실행 수가 limit을 넘지 않는다', async () => {
        const limit = 4;
        const items = Array.from({ length: 10 }, (_, i) => i);
        const deferreds = items.map(() => deferred<number>());

        let currentConcurrent = 0;
        let maxConcurrent = 0;

        const resultPromise = runWithPool(items, limit, async (_item, index) => {
            currentConcurrent++;
            maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
            const value = await deferreds[index].promise;
            currentConcurrent--;
            return value;
        });

        // 마이크로태스크 큐가 돌아 초기 워커들이 모두 시작될 시간을 준다
        await Promise.resolve();
        await Promise.resolve();

        expect(maxConcurrent).toBeLessThanOrEqual(limit);
        expect(maxConcurrent).toBe(limit);

        deferreds.forEach(({ resolve }, i) => resolve(i));
        await resultPromise;
    });

    it('결과 배열 순서가 입력 순서와 같다 (완료 순서가 뒤섞여도)', async () => {
        const items = ['a', 'b', 'c', 'd', 'e'];
        const deferreds = items.map(() => deferred<string>());

        const resultPromise = runWithPool(items, 2, async (_item, index) => {
            return await deferreds[index].promise;
        });

        // 완료 순서를 입력 순서와 뒤섞는다: index 순서상 뒤에 있는 항목을 먼저 resolve
        const resolveOrder = [4, 2, 0, 3, 1];
        for (const i of resolveOrder) {
            deferreds[i].resolve(items[i].toUpperCase());
            // 각 resolve 뒤 마이크로태스크를 흘려보내 실제로 처리 순서가 뒤섞이게 한다
            await Promise.resolve();
            await Promise.resolve();
        }

        const result = await resultPromise;
        expect(result).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('items.length < limit인 경우 정상 동작한다', async () => {
        const items = [1, 2, 3];
        const result = await runWithPool(items, 10, async (item) => item * 2);

        expect(result).toEqual([2, 4, 6]);
    });

    it('빈 배열이면 빈 배열을 반환한다', async () => {
        const result = await runWithPool([], 4, async (item) => item);

        expect(result).toEqual([]);
    });
});
