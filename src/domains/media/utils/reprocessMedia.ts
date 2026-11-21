import { useUploadSessionStore } from '@/domains/media/stores/useUploadSessionStore';
import { mediaAPI } from '@/libs/apis';
import { chunk } from '@/libs/utils/array';

// 재처리 요청 하나의 최대 장수(서버 상한). 서버가 장마다 원본 존재를 확인한다.
const REPROCESS_BATCH_LIMIT = 100;

export interface ReprocessSummary {
    /** 다시 처리하기 시작한 장수 */
    restarted: number;
    /** 원본이 없어 다시 처리할 수 없는 장수. 삭제하고 다시 올려야 한다. */
    sourceMissing: number;
    /** 요청 자체가 실패한 묶음이 있었는지 */
    requestFailed: boolean;
}

/** 처리에 실패한 사진을 다시 처리하고 결과를 세션 스토어에 반영한다(던지지 않는다). */
export const reprocessFailedMedia = async (tripKey: string, mediaFileIds: number[]): Promise<ReprocessSummary> => {
    const summary: ReprocessSummary = { restarted: 0, sourceMissing: 0, requestFailed: false };
    for (const ids of chunk(mediaFileIds, REPROCESS_BATCH_LIMIT)) {
        // 응답을 기다리는 사이 STOMP로 바뀐 항목을 가려내려고 보낼 때의 상태를 잡아 둔다
        const baseline = useUploadSessionStore.getState().images;
        const result = await mediaAPI.reprocessMedia(tripKey, ids);
        if (!result.success) {
            summary.requestFailed = true;
            continue;
        }
        useUploadSessionStore.getState().applyReprocessResults(result.data, baseline);
        for (const item of result.data) {
            if (item.status === 'UPLOADED') summary.restarted += 1;
            else if (item.status === 'SOURCE_MISSING') summary.sourceMissing += 1;
        }
    }
    return summary;
};
