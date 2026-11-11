import { DEFAULT_METADATA } from '@/domains/media/constants';
import { TripInfo } from '@/domains/trip/types';
import { Location } from '@/shared/types/map';

// 사용자 닉네임 유효성 검사
export const validateUserNickName = (inputValue: string, minLength = 2, maxLength = 10) => {
    const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ][가-힣a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ\s]*[가-힣a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ]$/;

    if (inputValue.length > 0 && inputValue.length < minLength) {
        return { valid: false, message: `닉네임은 최소 ${minLength}자 이상이어야 합니다` };
    } else if (inputValue.length > maxLength) {
        return { valid: false, message: `닉네임은 최대 ${maxLength}자까지 가능합니다` };
    } else if (inputValue.length !== 0 && !NICKNAME_REGEX.test(inputValue)) {
        return { valid: false, message: '특수문자나 시작과 끝에 공백을 사용할 수 없습니다' };
    } else {
        return { valid: true, message: '' };
    }
};

// 폼의 모든 필드에 입력했는지 검사
// 서버 응답에는 confirmed·shareId 같은 값도 섞이므로 필수 필드만 본다.
export const validateFormComplete = (form: TripInfo) =>
    Boolean(form.tripTitle?.trim() && form.country && form.startDate && form.endDate) &&
    form.startDate <= form.endDate &&
    (form.hashtags?.length ?? 0) > 0;

// 유효한 위치인지 검사
export const hasValidLocation = (location: Location | null): boolean =>
    location !== null && !!(location?.latitude && location?.longitude);

// 유효한 날짜인지 검사
export const hasValidDate = (date: string): boolean => !!date && !date.startsWith(DEFAULT_METADATA.DATE.split('T')[0]);
