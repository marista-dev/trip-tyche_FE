export const SOCKET_URL = {
    BASE: import.meta.env.VITE_WEBSOCKET_URL,
    TOPIC: {
        REQUEST: (userId: string) => `/topic/share-notifications/${userId}`,
        UNREAD: '/app/notification-count',
        MEDIA_PROCESSED: (userId: string) => `/topic/media-processed/${userId}`,
    },
};

export const SOCKET_SUBSCRIPTION = {
    SINGLE_VEHICLE: 'single_vehicle',
    ALL_VEHICLES: 'all_vehicles',
} as const;

export const SOCKET_CONFIG = {
    RECONNECT_DELAY: 5000,
    HEARTBEAT: {
        INCOMING: 4000,
        OUTGOING: 4000,
    },
};
