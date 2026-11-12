import { describe, expect, it } from 'vitest';

import { addStartDateAndEndDateToImageDates } from '@/libs/utils/media';

describe('날짜별 보기 날짜 목록', () => {
    it('당일여행은 날짜가 하나뿐이다 — 같은 날짜를 두 번 넣지 않는다', () => {
        expect(addStartDateAndEndDateToImageDates('2024-03-30', '2024-03-30', ['2024-03-30'])).toEqual(['2024-03-30']);
    });

    it('여러 날이면 시작일·사이 날짜·종료일 순서', () => {
        expect(
            addStartDateAndEndDateToImageDates('2025-10-03', '2025-10-05', ['2025-10-03', '2025-10-04', '2025-10-05']),
        ).toEqual(['2025-10-03', '2025-10-04', '2025-10-05']);
    });
});
