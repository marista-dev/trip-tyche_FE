import { useEffect, useRef } from 'react';

import { GlobeScene, GlobeSceneEvents } from './GlobeScene';

/**
 * 컨테이너 div에 점 지구본 씬을 한 번 만들어 붙인다.
 * events는 렌더마다 새로 넘겨도 되고(ref로 최신 값을 읽는다), 방문 나라가 바뀌면 점·핀만 다시 그린다.
 */
export const useGlobeScene = (visitedCountries: string[], events: GlobeSceneEvents) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<GlobeScene | null>(null);
    const eventsRef = useRef(events);
    eventsRef.current = events;

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;
        const scene = new GlobeScene(container, eventsRef);
        sceneRef.current = scene;
        return () => {
            scene.dispose();
            sceneRef.current = null;
        };
    }, []);

    useEffect(() => {
        sceneRef.current?.setVisitedCountries(visitedCountries);
    }, [visitedCountries]);

    return { mountRef, sceneRef };
};
