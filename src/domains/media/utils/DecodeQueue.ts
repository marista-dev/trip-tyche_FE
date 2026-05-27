export class DecodeQueue {
    private concurrency: number;
    private running = 0;
    private queue: Array<() => Promise<void>> = [];

    constructor(concurrency: number = 4) {
        this.concurrency = concurrency;
    }

    add(task: () => Promise<void>) {
        this.queue.push(task);
        this.tryNext();
    }

    private tryNext() {
        if (this.running >= this.concurrency || this.queue.length === 0) return;
        const task = this.queue.shift();
        if (!task) return;
        this.running++;
        task()
            .catch(() => undefined)
            .finally(() => {
                this.running--;
                this.tryNext();
            });
    }
}
