import { useRef } from 'react';

export interface NearbyState {
    key: string;
    indices: Set<number>;
}

/** 현재 위치 ±radius를 기록에 더한다. 목록(listKey)이 바뀌면 기록을 새로 시작한다 */
export const markNearby = (
    state: NearbyState | null,
    activeIndex: number,
    listKey: string,
    radius: number,
): NearbyState => {
    const next = state && state.key === listKey ? state : { key: listKey, indices: new Set<number>() };
    for (let i = activeIndex - radius; i <= activeIndex + radius; i++) next.indices.add(i);
    return next;
};

/**
 * 캐러셀 사진을 현재 위치 근처만 받게 한다.
 *
 * 사진 보기 화면은 슬라이드마다 원본(1920px WebP, 장당 수백 KB)을 <img>로 그린다. 전부 한 번에 그리면
 * 30장이면 수 MB를 동시에 받아 지금 보는 사진도 늦게 뜬다. 현재 ±radius 장만 src를 주고,
 * 한 번 받은 사진은 계속 둔다(다시 돌아왔을 때 깜빡이지 않게).
 *
 * 브라우저의 loading="lazy"는 가로 스크롤 안에서 미리 받는 거리가 브라우저마다 달라
 * 자동 넘김에서 빈 칸이 보일 수 있어, 위치 기준으로 직접 정한다.
 *
 * @param listKey 사진 목록이 바뀌면(다른 날짜·핀) 기록을 비운다
 */
export const useNearbyLoad = (activeIndex: number, listKey: string, radius = 2) => {
    const state = useRef<NearbyState | null>(null);
    state.current = markNearby(state.current, activeIndex, listKey, radius);
    const { indices } = state.current;
    return (index: number) => indices.has(index);
};
