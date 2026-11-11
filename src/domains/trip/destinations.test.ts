import { describe, expect, it } from 'vitest';

import {
    detectDestination,
    formatDestination,
    getArrivalCode,
    getCountryKey,
    getDepartureCode,
    getIndexLetter,
    KOREA_VALUE,
    searchDestinations,
    toChosung,
} from '@/domains/trip/destinations';

const JEJU = `${KOREA_VALUE}/제주`;
const JAPAN = '🇯🇵/일본/JAPAN';

describe('여행지 값', () => {
    it('지역을 붙여도 나라 키는 앞 3칸이다 — 지구본·통계가 나라 단위로 묶을 수 있다', () => {
        expect(getCountryKey(JEJU)).toBe(KOREA_VALUE);
        expect(getCountryKey(JAPAN)).toBe(JAPAN);
    });

    it('국내 여행은 GMP에서 지역 코드로 간다 — ICN → ICN이 찍히지 않는다', () => {
        expect(getDepartureCode(JEJU)).toBe('GMP');
        expect(getArrivalCode(JEJU)).toBe('CJU');
        expect(getArrivalCode(`${KOREA_VALUE}/서울`)).toBe('SEL');
        // 지역 기능 이전에 저장된 국내 여행
        expect(getDepartureCode(KOREA_VALUE)).toBe('GMP');
        expect(getArrivalCode(KOREA_VALUE)).toBe('KOR');
    });

    it('해외 여행은 기존대로 ICN에서 나라 공항으로 간다', () => {
        expect(getDepartureCode(JAPAN)).toBe('ICN');
        expect(getArrivalCode(JAPAN)).toBe('NRT');
        expect(getArrivalCode('')).toBe('TRP');
    });

    it('표시 이름', () => {
        expect(formatDestination(JEJU)).toEqual({ emoji: '🇰🇷', name: '제주', sub: '국내' });
        expect(formatDestination(KOREA_VALUE)).toEqual({ emoji: '🇰🇷', name: '대한민국', sub: '국내' });
        expect(formatDestination(JAPAN)).toEqual({ emoji: '🇯🇵', name: '일본' });
        expect(formatDestination('')).toBeNull();
    });
});

describe('검색', () => {
    const names = (q: string) => searchDestinations(q).map((o) => o.name);

    it('초성으로 찾는다', () => {
        expect(toChosung('일본')).toBe('ㅇㅂ');
        expect(names('ㅇㅂ')).toContain('일본');
        expect(names('ㅈㅈ')).toContain('제주');
    });

    it('영어·공항 코드·별칭으로 찾는다', () => {
        expect(names('japan')).toContain('일본');
        expect(names('NRT')).toContain('일본');
        expect(names('튀르키예')).toContain('터키');
        expect(names('하와이')).toContain('미국');
        expect(names('다낭')).toContain('베트남');
    });

    it('국내 지역과 나라를 한 검색창에서 찾는다', () => {
        expect(names('부산')).toContain('부산');
        expect(names('해운대')).toContain('부산');
        expect(names('한국')).toContain('대한민국');
    });

    it('해외 목록에는 대한민국이 따로 나오지 않는다', () => {
        expect(searchDestinations('').filter((o) => o.name === '대한민국' && o.sub !== '국내 · 지역 없이')).toEqual([]);
    });

    it('ㄱㄴㄷ 인덱스는 쌍자음을 기본 자음으로 묶는다', () => {
        expect(getIndexLetter('가나')).toBe('ㄱ');
        expect(getIndexLetter('뉴질랜드')).toBe('ㄴ');
    });
});

describe('사진 위치로 여행지 추정', () => {
    it('국내는 지역까지 정하고 자동 선택해도 된다', () => {
        const jeju = [
            { latitude: 33.45, longitude: 126.56 },
            { latitude: 33.25, longitude: 126.41 },
        ];
        expect(detectDestination(jeju)).toEqual({ value: JEJU, isConfident: true });
    });

    it('지역 목록에 없는 국내 장소는 대한민국으로', () => {
        expect(detectDestination([{ latitude: 36.98, longitude: 127.93 }])?.value).toBe(KOREA_VALUE);
    });

    it('해외는 추천만 한다', () => {
        expect(detectDestination([{ latitude: 34.69, longitude: 135.5 }])).toEqual({
            value: JAPAN,
            isConfident: false,
        });
        // 후쿠오카는 한국 범위 사각형에 걸치지만 일본으로 본다
        expect(detectDestination([{ latitude: 33.59, longitude: 130.4 }])?.value).toBe(JAPAN);
        expect(detectDestination([{ latitude: 21.31, longitude: -157.86 }])?.value).toBe('🇺🇸/미국/UNITED STATES');
    });

    it('다수결로 정하고, 위치 없는 사진(0,0)은 무시한다', () => {
        const mixed = [
            { latitude: 0, longitude: 0 },
            { latitude: 35.16, longitude: 129.16 },
            { latitude: 35.1, longitude: 129.04 },
            { latitude: 33.45, longitude: 126.56 },
        ];
        expect(detectDestination(mixed)?.value).toBe(`${KOREA_VALUE}/부산`);
        expect(detectDestination([{ latitude: 0, longitude: 0 }])).toBeNull();
    });
});
