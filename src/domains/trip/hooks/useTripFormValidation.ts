import { TripInfo } from '@/domains/trip/types';
import { validateFormComplete } from '@/libs/utils/validate';

/** 등록·수정 버튼 활성화 여부. 렌더마다 계산한다(상태로 두면 한 프레임 늦게 반영된다). */
export const useTripFormValidation = (tripInfo: TripInfo) => ({ isFormComplete: validateFormComplete(tripInfo) });
