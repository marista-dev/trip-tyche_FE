/** 지구본 좌표계: 반지름·위경도 → 3D 변환·나라별 핀 위치 */
import * as THREE from 'three';

import { TripSummary } from '@/domains/trip/types';

export const GLOBE_RADIUS = 0.78;

export const toVec3 = (lat: number, lng: number, r: number, out = new THREE.Vector3()): THREE.Vector3 => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

/** 나라 영문 대문자 이름 → 핀을 꽂을 [위도, 경도] */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
    'SOUTH KOREA': [37.5, 127.0],
    KOREA: [37.5, 127.0],
    JAPAN: [36.2, 138.2],
    CHINA: [35.9, 104.2],
    TAIWAN: [23.7, 121.0],
    'HONG KONG': [22.4, 114.1],
    SINGAPORE: [1.3, 103.8],
    THAILAND: [15.9, 100.9],
    VIETNAM: [14.1, 108.3],
    INDONESIA: [-1.0, 116.5],
    MALAYSIA: [3.8, 108.5],
    PHILIPPINES: [12.5, 122.8],
    CAMBODIA: [12.6, 104.9],
    MYANMAR: [17.1, 96.9],
    LAOS: [17.6, 102.5],
    MONGOLIA: [46.9, 103.8],
    INDIA: [20.6, 78.9],
    'SRI LANKA': [7.9, 80.8],
    NEPAL: [28.4, 84.1],
    PAKISTAN: [30.4, 69.3],
    BANGLADESH: [23.7, 90.4],
    FRANCE: [46.2, 2.2],
    ITALY: [41.9, 12.6],
    SPAIN: [40.5, -3.7],
    GERMANY: [51.2, 10.5],
    'UNITED KINGDOM': [55.4, -3.4],
    UK: [55.4, -3.4],
    PORTUGAL: [39.4, -8.2],
    GREECE: [39.1, 21.8],
    NETHERLANDS: [52.1, 5.3],
    SWITZERLAND: [46.8, 8.2],
    AUSTRIA: [47.5, 14.6],
    BELGIUM: [50.5, 4.5],
    'CZECH REPUBLIC': [50.1, 15.5],
    HUNGARY: [47.2, 19.5],
    POLAND: [51.9, 19.1],
    CROATIA: [45.1, 15.2],
    NORWAY: [60.5, 8.5],
    SWEDEN: [60.1, 18.6],
    DENMARK: [56.3, 9.5],
    FINLAND: [61.9, 25.8],
    ICELAND: [64.9, -19.0],
    IRELAND: [53.4, -8.2],
    ROMANIA: [45.9, 24.9],
    UKRAINE: [48.4, 31.2],
    RUSSIA: [61.5, 105.3],
    TURKEY: [38.9, 35.2],
    GEORGIA: [42.3, 43.4],
    SERBIA: [44.0, 21.0],
    'UNITED STATES': [37.1, -95.7],
    USA: [37.1, -95.7],
    CANADA: [56.1, -106.3],
    MEXICO: [23.6, -102.6],
    CUBA: [21.5, -79.5],
    'COSTA RICA': [9.7, -83.8],
    PANAMA: [8.5, -80.8],
    BRAZIL: [-14.2, -51.9],
    ARGENTINA: [-38.4, -63.6],
    CHILE: [-35.7, -71.5],
    PERU: [-9.2, -75.0],
    COLOMBIA: [4.6, -74.1],
    ECUADOR: [-1.8, -78.2],
    AUSTRALIA: [-25.3, 133.8],
    'NEW ZEALAND': [-40.9, 174.9],
    UAE: [23.4, 53.8],
    'UNITED ARAB EMIRATES': [23.4, 53.8],
    QATAR: [25.4, 51.2],
    'SAUDI ARABIA': [24.0, 45.0],
    ISRAEL: [31.0, 34.9],
    JORDAN: [30.6, 36.2],
    OMAN: [21.5, 55.9],
    BAHRAIN: [26.0, 50.6],
    KUWAIT: [29.3, 47.5],
    LEBANON: [33.9, 35.5],
    IRAN: [32.4, 53.7],
    EGYPT: [26.8, 30.8],
    MOROCCO: [31.8, -7.1],
    TUNISIA: [33.9, 9.5],
    'SOUTH AFRICA': [-30.6, 22.9],
    KENYA: [-0.0, 37.9],
    TANZANIA: [-6.4, 34.9],
    ETHIOPIA: [9.1, 40.5],
    NIGERIA: [9.1, 8.7],
    MALDIVES: [4.2, 73.5],
    UZBEKISTAN: [41.4, 64.6],
    KAZAKHSTAN: [47.2, 67.0],
};

/** "🇯🇵/일본/JAPAN(/지역)" → "JAPAN" */
const toCountryNameEn = (country: string) => ((country || '').split('/')[2] ?? '').trim().toUpperCase();

/** 여행을 나라(영문 이름)별로 묶는다. 나라가 비어 있는 여행은 뺀다 */
export const groupTripsByCountry = (trips: TripSummary[]): Map<string, TripSummary[]> => {
    const map = new Map<string, TripSummary[]>();
    trips.forEach((trip) => {
        const nameEn = toCountryNameEn(trip.country);
        if (!nameEn) return;
        const list = map.get(nameEn);
        if (list) list.push(trip);
        else map.set(nameEn, [trip]);
    });
    return map;
};
