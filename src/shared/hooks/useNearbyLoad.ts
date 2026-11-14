import { useEffect, useState } from 'react';

export interface NearbyState {
    key: string;
    indices: ReadonlySet<number>;
}

const EMPTY: ReadonlySet<number> = new Set();

/** 0..count-1 범위로 자른다. 목록이 바뀌어 이전 위치가 범위를 벗어나도 마지막 사진 근처는 받게 한다 */
export const clampIndex = (index: number, count: number) => Math.min(Math.max(index, 0), Math.max(count - 1, 0));

/** 현재 위치 ±radius를 더한 새 기록을 만든다(기존 기록은 바꾸지 않는다). 목록(key)이 바뀌면 새로 시작한다 */
export const markNearby = (
    state: NearbyState | null,
    activeIndex: number,
    key: string,
    radius: number,
): NearbyState => {
    const indices = new Set(state && state.key === key ? state.indices : EMPTY);
    for (let i = activeIndex - radius; i <= activeIndex + radius; i++) indices.add(i);
    return { key, indices };
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
 * 현재 범위는 렌더 중에 계산만 하고, "받은 적 있음" 기록은 커밋된 뒤(effect)에만 쌓는다.
 * 렌더 중에 기록을 바꾸면 버려진 렌더의 위치까지 남아 필요 없는 사진을 받게 된다.
 *
 * @param listKey 지금 화면에 그린 사진 목록을 나타내는 값. 목록이 바뀌면 기록을 비운다.
 *                라우트 값(날짜·핀)이 아니라 실제 목록으로 만들어야, 새 목록이 들어온 렌더에서 위치도 함께 초기화돼
 *                이전 목록의 위치가 새 목록에 기록되지 않는다.
 */
export const useNearbyLoad = (activeIndex: number, count: number, listKey: string, radius = 2) => {
    const current = clampIndex(activeIndex, count);
    const [state, setState] = useState<NearbyState | null>(null);

    useEffect(() => {
        setState((prev) => markNearby(prev, current, listKey, radius));
    }, [current, listKey, radius]);

    const seen = state && state.key === listKey ? state.indices : EMPTY;
    return (index: number) => Math.abs(index - current) <= radius || seen.has(index);
};

/** 사진 목록을 나타내는 키. 길이와 첫 사진으로 충분하다(같은 화면에서 목록이 바뀌는지만 알면 된다) */
export const photoListKey = (photos: { mediaFileId: number }[]) => `${photos.length}:${photos[0]?.mediaFileId ?? ''}`;
