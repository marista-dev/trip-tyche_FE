export interface UserInfo {
    userId: number;
    nickname: string;
    tripsCount: number;
    unreadNotificationsCount: number;
    role: 'USER' | 'GUEST';
    // 가입 시각. KST 기준이지만 백엔드 LocalDateTime이라 오프셋 없이 내려온다(예: 2026-11-11T21:00:55.253692).
    // 시간대를 해석해야 할 때 이 점을 기억할 것.
    createdAt: string;
}
