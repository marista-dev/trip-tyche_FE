export const MESSAGE = {
    NICKNAME_FORM: {
        TITLE: '새로운 닉네임을 입력해주세요 😀',
        PLACEHOLDER: '닉네임은 최대 10자까지 등록할 수 있습니다.',
    },
    QUOTE: '"여행의 발자국마다 이야기가 있고, 그 이야기가 당신의 지도가 됩니다"',
    LOGOUT_MODAL: {
        TITLE: '로그아웃',
        MESSAGE: '정말 로그아웃 하시겠습니까?',
        CONFIRM_TEXT: '확인',
        CANCEL_TEXT: '취소',
    },

    TRIP_IMAGES_UPLOAD: {
        message: '사진을 업로드해주세요.',
    },

    ERROR: {
        UNKNOWN: '알 수 없는 오류가 발생했습니다',
        NETWORK: '네트워크 연결 상태를 확인해주세요',
        SERVER: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요',
        TIMEOUT: '요청 시간이 초과되었습니다. 다시 시도해주세요',
    },
} as const;

export const BUTTON = {
    NEW_TRIP: '새로운 티켓 생성',
    NEXT: '다음',
    UPDATE_TRIP: '수정하기',
    LOGOUT: '로그아웃',
} as const;

export const GUIDE_MESSAGE = {
    IMAGE_UPLOAD: [
        '중복된 사진들의 경우, 1장으로 등록됩니다',
        '날짜 및 위치 정보가 없는 사진은 나중에 직접 등록하실 수 있습니다',
        '여행 중 찍은 사진을 모두 선택하면 자동으로 여정이 생성됩니다',
    ],
};

export const MAP = {
    PHOTO_CARD_SIZE: {
        WIDTH: 128,
        HEIGHT: 148,
    },
};

export const IMAGE_CAROUSEL_STATE = {
    AUTO: 'auto',
    PAUSED: 'paused',
    ZOOMED: 'zoomed',
} as const;

export const EMPTY_ITEM = {
    IMAGE: (category: string) => {
        switch (category) {
            case 'withAll':
                return {
                    title: '등록된 사진이 없어요',
                    description: '티켓 속 사진 관리에서\n새로운 사진을 등록해주세요',
                };
            case 'withoutLocation':
                return {
                    title: '위치 정보가 없는 사진이 없어요',
                    description: '모든 사진에 위치 정보가 포함되어 있습니다',
                };
            case 'withoutDate':
                return {
                    title: '날짜 정보가 없는 사진이 없어요',
                    description: '모든 사진에 촬영 날짜가 포함되어 있습니다',
                };
            default:
                return {
                    title: '등록된 사진이 없어요',
                    description: '티켓 속 사진 관리에서\n새로운 사진을 등록해주세요',
                };
        }
    },
};
