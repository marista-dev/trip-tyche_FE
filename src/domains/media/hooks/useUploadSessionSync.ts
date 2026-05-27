import { useEffect, useRef } from 'react';

import { useUploadSessionStore } from '@/domains/media/stores/useUploadSessionStore';
import type { MediaProcessedPayload } from '@/domains/media/types';
import { ProcessedEventBuffer } from '@/domains/media/utils/ProcessedEventBuffer';
import { mediaAPI } from '@/libs/apis/media';
import { addStompConnectListener } from '@/libs/socket';
import { SOCKET_URL } from '@/shared/constants/socket';
import { useStompTopic } from '@/shared/hooks/useStompTopic';

interface UseUploadSessionSyncOptions {
    enabled?: boolean;
}

export function useUploadSessionSync(
    tripKey: string | null,
    userId: number | null,
    options: UseUploadSessionSyncOptions = {},
) {
    const { enabled = true } = options;
    const syncImages = useUploadSessionStore((s) => s.syncImages);
    const batchMarkProcessed = useUploadSessionStore((s) => s.batchMarkProcessed);
    const batchMarkFailed = useUploadSessionStore((s) => s.batchMarkFailed);

    const bufferRef = useRef<ProcessedEventBuffer | null>(null);
    const initialSyncDoneRef = useRef(false);
    const pendingEventsRef = useRef<MediaProcessedPayload[]>([]);

    useEffect(() => {
        if (!enabled) return;
        bufferRef.current = new ProcessedEventBuffer((events) => {
            const processed = events.filter((e) => e.status === 'PROCESSED');
            const failed = events.filter((e) => e.status === 'FAILED');
            if (processed.length > 0) batchMarkProcessed(processed);
            if (failed.length > 0) batchMarkFailed(failed);
        }, 100);
        return () => {
            bufferRef.current?.destroy();
            bufferRef.current = null;
        };
    }, [enabled, batchMarkProcessed, batchMarkFailed]);

    const topic = enabled && userId !== null ? SOCKET_URL.TOPIC.MEDIA_PROCESSED(String(userId)) : null;
    useStompTopic<MediaProcessedPayload>(
        topic,
        (payload) => {
            if (!initialSyncDoneRef.current) {
                pendingEventsRef.current.push(payload);
                return;
            }
            bufferRef.current?.push(payload);
        },
        { enabled },
    );

    useEffect(() => {
        if (!enabled || !tripKey) return;
        let cancelled = false;
        initialSyncDoneRef.current = false;

        const runSync = async () => {
            const result = await mediaAPI.fetchUploadStatus(tripKey);
            if (cancelled) return;
            if (result.success) {
                syncImages(result.data);
            }
            const pending = pendingEventsRef.current;
            pendingEventsRef.current = [];
            for (const ev of pending) {
                bufferRef.current?.push(ev);
            }
            initialSyncDoneRef.current = true;
        };

        runSync().catch((err) => {
            console.error('[useUploadSessionSync] initial sync failed', err);
        });

        return () => {
            cancelled = true;
        };
    }, [enabled, tripKey, syncImages]);

    useEffect(() => {
        if (!enabled || !tripKey) return;
        const unregister = addStompConnectListener(() => {
            mediaAPI
                .fetchUploadStatus(tripKey)
                .then((result) => {
                    if (result.success) syncImages(result.data);
                })
                .catch((err) => console.error('[useUploadSessionSync] reconnect sync failed', err));
        });
        return unregister;
    }, [enabled, tripKey, syncImages]);
}
