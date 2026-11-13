/*
 * Google Maps 지도 인스턴스 재사용 풀.
 *
 * google.maps.Map은 만든 뒤 없앨 방법이 없다. 화면에서 떼어 내도 내부 타일·WebGL 컨텍스트·worker가 남는다.
 * 페이지에 들어올 때마다 새로 만들면(@react-google-maps/api의 <GoogleMap>) 왕복할수록 메모리가 쌓이고,
 * Vector 지도는 WebGL 컨텍스트도 하나씩 늘어난다. 로컬 측정에서 지구본 ↔ 경로 지도 18회 왕복에
 * JS 힙 773MB, "Too many active WebGL contexts. Oldest context will be lost" 경고가 났다.
 * 안드로이드 WebView에서는 이 시점 전에 렌더러가 죽거나 컨텍스트를 잃어 검은 화면이 된다.
 *
 * 그래서 지도는 자기 div와 함께 만들어 두고, 쓰는 동안 화면에 붙였다가 다 쓰면 떼어 풀에 돌려준다.
 * 동시에 보이는 지도 수만큼만 인스턴스가 생긴다(지금은 화면당 1개). Google 문서도 지도 인스턴스 재사용을 권한다.
 */

export interface PooledMap {
    readonly map: google.maps.Map;
    /** 지도가 그려지는 div. 사용하는 쪽이 자기 컨테이너에 붙였다가 반납 때 뗀다 */
    readonly element: HTMLDivElement;
}

interface Entry extends PooledMap {
    inUse: boolean;
}

const pool: Entry[] = [];

/** mapId는 지도를 만든 뒤 바꿀 수 없다. 이미 있는 지도에 옵션을 다시 적용할 때는 빼고 넘긴다 */
export const withoutMapId = (options: google.maps.MapOptions): google.maps.MapOptions => {
    const rest = { ...options };
    delete rest.mapId;
    return rest;
};

/**
 * 쉬고 있는 지도를 꺼내고, 없으면 새로 만든다. 이전 사용에서 바뀐 카메라·옵션은 여기서 되돌린다.
 * mapId는 지도를 만든 뒤 바꿀 수 없다. 앱 전체가 같은 mapId를 쓰므로 풀은 하나로 충분하다.
 */
export const acquireMap = (options: google.maps.MapOptions): PooledMap => {
    const idle = pool.find((entry) => !entry.inUse);
    if (idle) {
        idle.inUse = true;
        idle.map.setOptions(withoutMapId(options));
        // 경로 지도의 드론 뷰가 남긴 기울기·회전을 되돌린다(장소 선택 지도는 정면 지도를 기대한다)
        idle.map.setTilt(0);
        idle.map.setHeading(0);
        return idle;
    }
    const element = document.createElement('div');
    element.style.width = '100%';
    element.style.height = '100%';
    const entry: Entry = { map: new google.maps.Map(element, options), element, inUse: true };
    pool.push(entry);
    return entry;
};

/** 지도를 화면에서 떼고 풀에 돌려준다. 마커·폴리라인은 각 컴포넌트가 언마운트에서 이미 지운다 */
export const releaseMap = (pooled: PooledMap) => {
    const entry = pool.find((e) => e.map === pooled.map);
    if (!entry) return;
    entry.element.remove();
    entry.inUse = false;
};

/** 테스트용: 풀 상태 */
export const mapPoolSize = () => ({ total: pool.length, inUse: pool.filter((e) => e.inUse).length });
