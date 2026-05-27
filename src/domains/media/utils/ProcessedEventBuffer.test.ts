import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ProcessedEventBuffer } from './ProcessedEventBuffer';

describe('ProcessedEventBuffer', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('groups events arriving within 100ms window', () => {
        const onFlush = vi.fn();
        const buf = new ProcessedEventBuffer(onFlush);
        buf.push({ mediaFileId: 1, status: 'PROCESSED', finalUrl: 'a' });
        buf.push({ mediaFileId: 2, status: 'PROCESSED', finalUrl: 'b' });
        vi.advanceTimersByTime(100);
        expect(onFlush).toHaveBeenCalledTimes(1);
        expect(onFlush.mock.calls[0][0]).toHaveLength(2);
    });

    it('deduplicates same mediaFileId, keeping latest', () => {
        const onFlush = vi.fn();
        const buf = new ProcessedEventBuffer(onFlush);
        buf.push({ mediaFileId: 1, status: 'PROCESSED', finalUrl: 'first' });
        buf.push({ mediaFileId: 1, status: 'PROCESSED', finalUrl: 'second' });
        vi.advanceTimersByTime(100);
        expect(onFlush).toHaveBeenCalledTimes(1);
        const flushed = onFlush.mock.calls[0][0];
        expect(flushed).toHaveLength(1);
        expect(flushed[0].finalUrl).toBe('second');
    });

    it('does not call onFlush after destroy', () => {
        const onFlush = vi.fn();
        const buf = new ProcessedEventBuffer(onFlush);
        buf.push({ mediaFileId: 1, status: 'PROCESSED', finalUrl: 'a' });
        buf.destroy();
        vi.advanceTimersByTime(200);
        expect(onFlush).not.toHaveBeenCalled();
        buf.destroy();
    });

    it('does not call onFlush when flushed with no pending events', () => {
        const onFlush = vi.fn();
        new ProcessedEventBuffer(onFlush);
        vi.advanceTimersByTime(200);
        expect(onFlush).not.toHaveBeenCalled();
    });
});
