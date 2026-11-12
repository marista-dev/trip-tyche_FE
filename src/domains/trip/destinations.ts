import { COUNTRIES } from '@/domains/trip/constants';
import { Country } from '@/domains/trip/types';
import { Location } from '@/shared/types/map';

/*
 * 저장 형식: 나라 값 + '/지역' ("🇰🇷/대한민국/SOUTH KOREA/제주").
 * 서버는 문자열 그대로 저장하고 기존 파서는 앞 3칸만 읽어 호환된다. 나라 단위로 묶을 땐 getCountryKey.
 */

export const KOREA_VALUE = '🇰🇷/대한민국/SOUTH KOREA';

export interface Region {
    name: string;
    nameEn: string;
    aliases: string[];
    /** [남, 북, 서, 동] — 사진 GPS 판정용 대략 범위 */
    bounds: [number, number, number, number];
}

// 범위가 겹치면 먼저 나온 지역이 이긴다 — 좁은 도시를 앞에 둔다.
const REGIONS: Region[] = [
    {
        name: '제주',
        nameEn: 'JEJU',
        aliases: ['제주도', '서귀포', 'jeju'],
        bounds: [33.1, 33.6, 126.1, 127.0],
    },
    { name: '서울', nameEn: 'SEOUL', aliases: ['seoul'], bounds: [37.42, 37.7, 126.76, 127.19] },
    { name: '부산', nameEn: 'BUSAN', aliases: ['해운대', 'busan'], bounds: [35.0, 35.4, 128.75, 129.3] },
    { name: '인천', nameEn: 'INCHEON', aliases: ['incheon'], bounds: [37.3, 37.65, 126.35, 126.76] },
    { name: '강릉', nameEn: 'GANGNEUNG', aliases: ['gangneung'], bounds: [37.6, 37.95, 128.7, 129.1] },
    {
        name: '속초·양양',
        nameEn: 'SOKCHO',
        aliases: ['속초', '양양', 'sokcho'],
        bounds: [37.95, 38.35, 128.4, 128.75],
    },
    { name: '경주', nameEn: 'GYEONGJU', aliases: ['gyeongju'], bounds: [35.7, 35.95, 129.0, 129.45] },
    { name: '포항', nameEn: 'POHANG', aliases: ['pohang'], bounds: [35.95, 36.35, 129.2, 129.6] },
    { name: '여수', nameEn: 'YEOSU', aliases: ['yeosu'], bounds: [34.55, 34.95, 127.45, 127.85] },
    { name: '전주', nameEn: 'JEONJU', aliases: ['jeonju'], bounds: [35.75, 35.9, 127.05, 127.2] },
    {
        name: '통영·거제',
        nameEn: 'TONGYEONG',
        aliases: ['통영', '거제', 'tongyeong'],
        bounds: [34.7, 35.05, 128.25, 128.75],
    },
    { name: '대구', nameEn: 'DAEGU', aliases: ['daegu'], bounds: [35.75, 36.0, 128.45, 128.75] },
    { name: '대전', nameEn: 'DAEJEON', aliases: ['daejeon'], bounds: [36.2, 36.5, 127.25, 127.55] },
    { name: '광주', nameEn: 'GWANGJU', aliases: ['gwangju'], bounds: [35.05, 35.25, 126.7, 127.0] },
    { name: '울산', nameEn: 'ULSAN', aliases: ['ulsan'], bounds: [35.35, 35.7, 129.0, 129.45] },
    { name: '안동', nameEn: 'ANDONG', aliases: ['andong'], bounds: [36.45, 36.7, 128.55, 128.9] },
    { name: '청주', nameEn: 'CHEONGJU', aliases: ['cheongju'], bounds: [36.5, 36.75, 127.35, 127.6] },
    {
        name: '춘천·가평',
        nameEn: 'CHUNCHEON',
        aliases: ['춘천', '가평', 'chuncheon'],
        bounds: [37.7, 38.0, 127.35, 127.85],
    },
];

const INTERNATIONAL_DEPARTURE = 'ICN';
const FALLBACK_IATA = 'TRP';

const KOREA_BOUNDS: [number, number, number, number] = [33.0, 38.7, 124.5, 132.0];
/** 한국 범위 사각형에 걸치는 대한해협 동쪽(후쿠오카·쓰시마) — 한국으로 보지 않는다 */
const KOREA_STRAIT_EAST: [number, number, number, number] = [33.0, 35.5, 129.4, 132.0];

export interface Destination {
    /** 나라 값(앞 3칸) — COUNTRIES의 value와 같다 */
    countryValue: string;
    country?: Country;
    region?: Region;
    isDomestic: boolean;
}

export const getCountryKey = (value?: string): string => (value ?? '').split('/').slice(0, 3).join('/');

export const parseDestination = (value?: string): Destination => {
    const countryValue = getCountryKey(value);
    const regionName = (value ?? '').split('/')[3];
    return {
        countryValue,
        country: COUNTRIES.find((c) => c.value === countryValue),
        region: regionName ? REGIONS.find((r) => r.name === regionName) : undefined,
        isDomestic: countryValue === KOREA_VALUE,
    };
};

const toRegionValue = (region: Region) => `${KOREA_VALUE}/${region.name}`;

/** 입력칸·티켓에 보여줄 이름. "🇯🇵 일본", "🇰🇷 제주" */
export const formatDestination = (value?: string): { emoji: string; name: string; sub?: string } | null => {
    if (!value) return null;
    const { country, region, isDomestic, countryValue } = parseDestination(value);
    const [emoji = '', nameKo = ''] = countryValue.split('/');
    if (isDomestic) return { emoji, name: region?.name ?? '대한민국', sub: '국내' };
    return { emoji: country?.emoji ?? emoji, name: country?.nameKo ?? nameKo };
};

export interface RoutePoint {
    label: string;
    sub?: string;
    isCode: boolean;
}

export interface TicketRoute {
    from: RoutePoint;
    to: RoutePoint;
}

const DOMESTIC_DEPARTURE: RoutePoint = { label: '국내', sub: 'DOMESTIC', isCode: false };
const KOREA_NAME_EN = 'KOREA';

export const getRoute = (value?: string): TicketRoute => {
    const { country, region, isDomestic } = parseDestination(value);
    if (isDomestic) {
        return {
            from: DOMESTIC_DEPARTURE,
            to: { label: region?.name ?? '대한민국', sub: region?.nameEn ?? KOREA_NAME_EN, isCode: false },
        };
    }
    return {
        from: { label: INTERNATIONAL_DEPARTURE, isCode: true },
        to: { label: (value && country?.iata) || FALLBACK_IATA, isCode: true },
    };
};

export const getPlaceEn = (value?: string): string => {
    const { country, region, isDomestic, countryValue } = parseDestination(value);
    if (isDomestic) return region?.nameEn ?? KOREA_NAME_EN;
    return (country?.nameEn ?? countryValue.split('/')[2] ?? '').toUpperCase();
};

const CHOSUNG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

/** "일본" → "ㅇㅂ" */
export const toChosung = (text: string): string =>
    Array.from(text)
        .map((ch) => {
            const code = ch.charCodeAt(0) - 0xac00;
            return code >= 0 && code <= 11171 ? CHOSUNG[Math.floor(code / 588)] : ch;
        })
        .join('');

const isChosungOnly = (text: string) => /^[ㄱ-ㅎ]+$/.test(text);

/** 공식 이름과 다르게 부르는 이름. 지역(괌·하와이 등)은 그 나라로 찾아지게 한다. */
const COUNTRY_ALIASES: Record<string, string[]> = {
    'UNITED STATES': ['미국', 'usa', 'us', '하와이', '괌', '사이판', '뉴욕', 'la', '라스베가스'],
    'UNITED KINGDOM': ['uk', '영국', '잉글랜드', '런던'],
    TURKEY: ['튀르키예', '터키', 'turkiye'],
    AUSTRALIA: ['호주', '오스트레일리아'],
    'CZECH REPUBLIC': ['체코', '체키아', 'czechia'],
    'UNITED ARAB EMIRATES': ['uae', '두바이', '아부다비'],
    JAPAN: ['오사카', '도쿄', '후쿠오카', '오키나와', '삿포로'],
    VIETNAM: ['다낭', '하노이', '호치민', '나트랑', '푸꾸옥'],
    THAILAND: ['방콕', '푸켓', '치앙마이'],
    PHILIPPINES: ['세부', '보라카이', '마닐라', '보홀'],
    INDONESIA: ['발리'],
    CHINA: ['상하이', '베이징', '칭다오'],
    TAIWAN: ['타이베이', '가오슝'],
    MACAU: ['macao'],
    NETHERLANDS: ['네덜란드', '암스테르담', 'holland'],
    'SOUTH AFRICA': ['남아공'],
};

interface DestinationOption {
    value: string;
    emoji: string;
    name: string;
    sub?: string;
}

const matches = (query: string, names: string[]): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    if (isChosungOnly(q)) return names.some((n) => toChosung(n).startsWith(q));
    return names.some((n) => n.toLowerCase().includes(q));
};

const toRegionOption = (r: Region): DestinationOption => ({
    value: toRegionValue(r),
    emoji: '🇰🇷',
    name: r.name,
    sub: '국내',
});

export const regionOptions: DestinationOption[] = REGIONS.map(toRegionOption);

/** 대한민국은 국내 지역으로 고르므로 뺀다. */
export const overseasCountries: Country[] = COUNTRIES.filter((c) => c.value !== KOREA_VALUE).sort((a, b) =>
    a.nameKo.localeCompare(b.nameKo, 'ko'),
);

export const searchDestinations = (query: string): DestinationOption[] => {
    const regions = REGIONS.filter((r) => matches(query, [r.name, r.nameEn, ...r.aliases])).map(toRegionOption);
    const korea = matches(query, ['대한민국', '한국', 'korea', '국내'])
        ? [{ value: KOREA_VALUE, emoji: '🇰🇷', name: '대한민국', sub: '국내 · 지역 없이' }]
        : [];
    const countries = overseasCountries
        .filter((c) => matches(query, [c.nameKo, c.nameEn, c.iata, ...(COUNTRY_ALIASES[c.nameEn] ?? [])]))
        .map((c) => ({ value: c.value, emoji: c.emoji, name: c.nameKo, sub: c.nameEn }));
    return [...regions, ...korea, ...countries];
};

/** ㄱㄴㄷ 인덱스용 첫 글자 초성(쌍자음은 기본 자음으로) */
export const getIndexLetter = (name: string): string => {
    const first = toChosung(name.charAt(0));
    return { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }[first] ?? first;
};

export type PhotoLocation = Location;

const inBounds = ({ latitude, longitude }: PhotoLocation, [s, n, w, e]: [number, number, number, number]) =>
    latitude >= s && latitude <= n && longitude >= w && longitude <= e;

// 해외는 대표 지점(수도·여행 도시)과의 거리로 추정한다 — 국경 근처에선 틀릴 수 있어 추천만 한다.
const COUNTRY_ANCHORS: Record<string, [number, number][]> = {
    JAPAN: [
        [35.68, 139.69],
        [34.69, 135.5],
        [43.06, 141.35],
        [33.59, 130.4],
        [26.21, 127.68],
    ],
    CHINA: [
        [39.9, 116.4],
        [31.23, 121.47],
        [23.13, 113.26],
        [30.57, 104.07],
        [36.07, 120.38],
    ],
    TAIWAN: [
        [25.03, 121.56],
        [22.63, 120.3],
    ],
    'HONG KONG': [[22.32, 114.17]],
    MACAU: [[22.2, 113.55]],
    MONGOLIA: [[47.92, 106.92]],
    VIETNAM: [
        [21.03, 105.85],
        [16.05, 108.2],
        [10.82, 106.63],
        [12.24, 109.19],
        [10.29, 103.98],
    ],
    THAILAND: [
        [13.75, 100.5],
        [18.79, 98.98],
        [7.88, 98.39],
    ],
    PHILIPPINES: [
        [14.6, 120.98],
        [10.32, 123.89],
        [11.97, 121.92],
        [9.65, 123.85],
    ],
    INDONESIA: [
        [-6.2, 106.85],
        [-8.41, 115.19],
    ],
    MALAYSIA: [
        [3.14, 101.69],
        [5.98, 116.07],
    ],
    SINGAPORE: [[1.35, 103.82]],
    CAMBODIA: [
        [11.56, 104.92],
        [13.36, 103.86],
    ],
    LAOS: [
        [17.97, 102.6],
        [19.89, 102.13],
    ],
    MYANMAR: [[16.87, 96.2]],
    BRUNEI: [[4.94, 114.95]],
    NEPAL: [[27.72, 85.32]],
    INDIA: [
        [28.61, 77.21],
        [19.08, 72.88],
        [12.97, 77.59],
        [15.3, 74.12],
    ],
    'SRI LANKA': [[6.93, 79.86]],
    BANGLADESH: [[23.81, 90.41]],
    PAKISTAN: [
        [33.68, 73.05],
        [24.86, 67.0],
    ],
    MALDIVES: [[4.18, 73.51]],
    UZBEKISTAN: [[41.3, 69.24]],
    KAZAKHSTAN: [
        [43.24, 76.95],
        [51.17, 71.45],
    ],
    GEORGIA: [[41.72, 44.79]],
    RUSSIA: [
        [55.76, 37.62],
        [59.93, 30.34],
        [43.12, 131.89],
    ],
    'UNITED ARAB EMIRATES': [
        [25.2, 55.27],
        [24.45, 54.38],
    ],
    QATAR: [[25.29, 51.53]],
    BAHRAIN: [[26.23, 50.59]],
    KUWAIT: [[29.38, 47.99]],
    OMAN: [[23.59, 58.41]],
    'SAUDI ARABIA': [
        [24.71, 46.68],
        [21.49, 39.19],
    ],
    IRAQ: [[33.31, 44.36]],
    ISRAEL: [
        [31.77, 35.21],
        [32.08, 34.78],
    ],
    TURKEY: [
        [41.01, 28.98],
        [39.93, 32.85],
        [38.64, 34.83],
        [36.9, 30.71],
    ],
    EGYPT: [
        [30.04, 31.24],
        [25.69, 32.64],
    ],
    MOROCCO: [
        [31.63, -8.0],
        [33.57, -7.59],
    ],
    ALGERIA: [[36.75, 3.06]],
    KENYA: [[-1.29, 36.82]],
    CAMEROON: [[3.85, 11.5]],
    GHANA: [[5.6, -0.19]],
    'SOUTH AFRICA': [
        [-33.92, 18.42],
        [-26.2, 28.05],
    ],
    SEYCHELLES: [[-4.62, 55.45]],
    'UNITED KINGDOM': [
        [51.51, -0.13],
        [55.95, -3.19],
        [53.48, -2.24],
    ],
    IRELAND: [[53.35, -6.26]],
    FRANCE: [
        [48.86, 2.35],
        [43.3, 5.37],
        [43.7, 7.26],
        [45.76, 4.84],
    ],
    MONACO: [[43.74, 7.42]],
    BELGIUM: [[50.85, 4.35]],
    NETHERLANDS: [[52.37, 4.9]],
    LUXEMBOURG: [[49.61, 6.13]],
    GERMANY: [
        [52.52, 13.4],
        [48.14, 11.58],
        [50.11, 8.68],
        [53.55, 10.0],
    ],
    SWITZERLAND: [
        [47.37, 8.54],
        [46.2, 6.14],
        [46.95, 7.45],
        [46.69, 7.86],
    ],
    AUSTRIA: [
        [48.21, 16.37],
        [47.81, 13.04],
        [47.27, 11.4],
    ],
    ITALY: [
        [41.9, 12.5],
        [45.46, 9.19],
        [43.77, 11.26],
        [45.44, 12.32],
        [40.85, 14.27],
    ],
    'SAN MARINO': [[43.94, 12.45]],
    SPAIN: [
        [40.42, -3.7],
        [41.39, 2.17],
        [37.39, -5.98],
    ],
    PORTUGAL: [
        [38.72, -9.14],
        [41.15, -8.61],
    ],
    'CZECH REPUBLIC': [[50.08, 14.43]],
    HUNGARY: [[47.5, 19.04]],
    POLAND: [
        [52.23, 21.01],
        [50.06, 19.94],
    ],
    CROATIA: [
        [45.81, 15.98],
        [42.65, 18.09],
        [43.51, 16.44],
    ],
    SERBIA: [[44.79, 20.45]],
    'BOSNIA AND HERZEGOVINA': [[43.86, 18.41]],
    ROMANIA: [[44.43, 26.1]],
    GREECE: [
        [37.98, 23.73],
        [36.39, 25.46],
    ],
    UKRAINE: [[50.45, 30.52]],
    ESTONIA: [[59.44, 24.75]],
    FINLAND: [[60.17, 24.94]],
    SWEDEN: [[59.33, 18.07]],
    NORWAY: [
        [59.91, 10.75],
        [60.39, 5.32],
    ],
    DENMARK: [[55.68, 12.57]],
    ICELAND: [[64.15, -21.94]],
    'UNITED STATES': [
        [40.71, -74.01],
        [34.05, -118.24],
        [37.77, -122.42],
        [36.17, -115.14],
        [41.88, -87.63],
        [25.76, -80.19],
        [47.61, -122.33],
        [39.0, -98.0],
        [21.31, -157.86],
        [13.44, 144.79],
        [15.18, 145.75],
        [61.22, -149.9],
        [36.1, -112.1],
    ],
    CANADA: [
        [43.65, -79.38],
        [49.28, -123.12],
        [45.5, -73.57],
        [51.05, -114.07],
    ],
    MEXICO: [
        [19.43, -99.13],
        [21.16, -86.85],
    ],
    JAMAICA: [[18.0, -76.79]],
    'DOMINICAN REPUBLIC': [[18.47, -69.9]],
    'COSTA RICA': [[9.93, -84.08]],
    PANAMA: [[8.98, -79.52]],
    COLOMBIA: [[4.71, -74.07]],
    ECUADOR: [[-0.18, -78.47]],
    PERU: [
        [-12.05, -77.04],
        [-13.53, -71.97],
    ],
    BRAZIL: [
        [-22.91, -43.17],
        [-23.55, -46.63],
        [-15.79, -47.88],
    ],
    ARGENTINA: [[-34.6, -58.38]],
    CHILE: [[-33.45, -70.67]],
    URUGUAY: [[-34.9, -56.16]],
    PARAGUAY: [[-25.26, -57.58]],
    AUSTRALIA: [
        [-33.87, 151.21],
        [-37.81, 144.96],
        [-27.47, 153.03],
        [-31.95, 115.86],
        [-16.92, 145.77],
    ],
    'NEW ZEALAND': [
        [-36.85, 174.76],
        [-45.03, 168.66],
        [-43.53, 172.64],
    ],
};

/** 대표 지점에서 이보다 멀면(도 단위, 약 1,000km) 추천하지 않는다. */
const MAX_ANCHOR_DISTANCE = 9;

const nearestCountry = ({ latitude, longitude }: PhotoLocation): string | null => {
    let bestName: string | null = null;
    let bestDist = MAX_ANCHOR_DISTANCE;
    for (const [nameEn, points] of Object.entries(COUNTRY_ANCHORS)) {
        for (const [lat, lng] of points) {
            const dist = Math.hypot(latitude - lat, (longitude - lng) * Math.cos((latitude * Math.PI) / 180));
            if (dist <= bestDist) {
                bestName = nameEn;
                bestDist = dist;
            }
        }
    }
    return bestName;
};

const detectOne = (loc: PhotoLocation): string | null => {
    if (inBounds(loc, KOREA_BOUNDS) && !inBounds(loc, KOREA_STRAIT_EAST)) {
        const region = REGIONS.find((r) => inBounds(loc, r.bounds));
        return region ? toRegionValue(region) : KOREA_VALUE;
    }
    const nameEn = nearestCountry(loc);
    return nameEn ? (COUNTRIES.find((c) => c.nameEn === nameEn)?.value ?? null) : null;
};

export interface DetectedDestination {
    value: string;
    /** true: 자동 선택(국내 경계 판정), false: 추천만 */
    isConfident: boolean;
}

/** 위치가 있는 사진들의 다수결. 위치 정보가 없으면 null. */
export const detectDestination = (locations: PhotoLocation[]): DetectedDestination | null => {
    const counts = new Map<string, number>();
    locations
        .filter((l) => l && (l.latitude !== 0 || l.longitude !== 0)) // 0,0 = 위치 없는 사진
        .forEach((l) => {
            const value = detectOne(l);
            if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
        });
    if (counts.size === 0) return null;
    const [value] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { value, isConfident: parseDestination(value).isDomestic };
};
