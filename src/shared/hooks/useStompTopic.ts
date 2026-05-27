import { useEffect, useRef } from 'react';

import type { IMessage, StompSubscription } from '@stomp/stompjs';

import { addStompConnectListener, getStompClient, isStompConnected } from '@/libs/socket';

interface UseStompTopicOptions {
    enabled?: boolean;
}

export function useStompTopic<T>(
    topic: string | null,
    handler: (payload: T) => void,
    options: UseStompTopicOptions = {},
) {
    const { enabled = true } = options;
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        if (!enabled || !topic) return;

        let subscription: StompSubscription | null = null;
        let cancelled = false;

        const doSubscribe = () => {
            if (cancelled) return;
            const client = getStompClient();
            if (!client || !client.connected) return;
            subscription = client.subscribe(topic, (message: IMessage) => {
                try {
                    const payload = JSON.parse(message.body) as T;
                    handlerRef.current(payload);
                } catch (err) {
                    console.error('[useStompTopic] parse error', err, message.body);
                }
            });
        };

        if (isStompConnected()) {
            doSubscribe();
        }
        const unregister = addStompConnectListener(doSubscribe);

        return () => {
            cancelled = true;
            unregister();
            subscription?.unsubscribe();
        };
    }, [topic, enabled]);
}
