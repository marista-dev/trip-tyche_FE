import type { MediaProcessedPayload } from '@/domains/media/types';

export class ProcessedEventBuffer {
    private pending: Map<number, MediaProcessedPayload> = new Map();
    private timer: ReturnType<typeof setTimeout> | null = null;
    private readonly windowMs: number;

    constructor(
        private onFlush: (events: MediaProcessedPayload[]) => void,
        windowMs: number = 100,
    ) {
        this.windowMs = windowMs;
    }

    push(event: MediaProcessedPayload) {
        this.pending.set(event.mediaFileId, event);
        if (this.timer) return;
        this.timer = setTimeout(() => this.flush(), this.windowMs);
    }

    private flush() {
        if (this.pending.size === 0) {
            this.timer = null;
            return;
        }
        const events = Array.from(this.pending.values());
        this.pending.clear();
        this.timer = null;
        this.onFlush(events);
    }

    destroy() {
        if (this.timer) clearTimeout(this.timer);
        this.pending.clear();
        this.timer = null;
    }
}
