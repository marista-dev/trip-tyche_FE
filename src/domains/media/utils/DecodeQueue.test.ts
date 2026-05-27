import { describe, it, expect, vi } from 'vitest';

import { DecodeQueue } from './DecodeQueue';

function deferred() {
    let resolve!: () => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('DecodeQueue', () => {
    it('runs at most concurrency tasks simultaneously (concurrency=4)', async () => {
        const queue = new DecodeQueue(4);
        let maxConcurrent = 0;
        let currentConcurrent = 0;
        const deferreds = Array.from({ length: 5 }, () => deferred());

        deferreds.forEach(({ promise }) => {
            queue.add(async () => {
                currentConcurrent++;
                maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
                await promise;
                currentConcurrent--;
            });
        });

        expect(maxConcurrent).toBe(4);

        deferreds.forEach(({ resolve }) => resolve());
        await Promise.resolve();
    });

    it('continues processing after a task rejects', async () => {
        const queue = new DecodeQueue(1);
        const ran = vi.fn();

        const failDeferred = deferred();
        const successDeferred = deferred();

        queue.add(async () => {
            await failDeferred.promise;
        });
        queue.add(async () => {
            await successDeferred.promise;
            ran();
        });

        failDeferred.reject(new Error('task failed'));
        failDeferred.promise.catch(() => {});
        await Promise.resolve();
        await Promise.resolve();

        successDeferred.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(ran).toHaveBeenCalledTimes(1);
    });

    it('eventually runs all tasks', async () => {
        const queue = new DecodeQueue(2);
        const ran: number[] = [];
        const deferreds = Array.from({ length: 6 }, () => deferred());

        deferreds.forEach(({ promise }, i) => {
            queue.add(async () => {
                await promise;
                ran.push(i);
            });
        });

        for (const { resolve } of deferreds) {
            resolve();
            await Promise.resolve();
            await Promise.resolve();
        }

        expect(ran).toHaveLength(6);
    });
});
