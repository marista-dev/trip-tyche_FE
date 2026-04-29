type UserId = number;
type TripKey = string;
type PinPointId = number;

export const ROUTES = {
    PATH: {
        ONBOARDING: '/onboarding',
        SIGNIN: '/signin',
        MAIN: '/',
        HOME: '/',
        TICKETS: '/tickets',
        SETTING: '/setting',
        NOTIFICATION: (userId: UserId) => `/notification/${userId}`,
        TRIP: {
            ROOT: (tripKey: TripKey) => `/trip/${tripKey}`,
            NEW: (tripKey: TripKey) => `/trip/${tripKey}/new`,
            EDIT: {
                IMAGE: (tripKey: TripKey) => `/trip/${tripKey}/edit/image`,
                INFO: (tripKey: TripKey) => `/trip/${tripKey}/edit/info`,
            },
            IMAGE: {
                BY_PINPOINT: (tripKey: TripKey, pinPointId: PinPointId) =>
                    `/trip/${tripKey}/image/by-pinpoint/${pinPointId}`,
                BY_DATE: (tripKey: TripKey, date: string) => `/trip/${tripKey}/image/by-date/${date}`,
            },
        },
    },
    PATH_TITLE: {
        MAIN: '메인',
        ONBOARDING: '온보딩',
        AUTH: {
            LOGIN: '로그인',
            LOGIN_REDIRECT: '로그인 리다이렉트',
        },
        SETTING: '설정',
        TRIPS: {
            NEW: {
                IMAGES: '여행 사진 관리',
                LOCATIONS: '위치 등록',
                INFO: '여행 정보 입력',
            },
            EDIT: '여행 티켓 수정',
            TIMELINE: {
                MAP: '타임라인 지도',
                PINPOINT: '핀포인트',
                DATE: '날짜별 보기',
            },
        },
    },
} as const;
