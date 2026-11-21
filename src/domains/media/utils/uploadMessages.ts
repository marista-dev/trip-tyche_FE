import type { ReprocessSummary } from '@/domains/media/utils/reprocessMedia';
import { UploadChainError, type UploadPhase, type UploadStats } from '@/domains/media/utils/uploadChain';
import { REJECT_REASON_LABEL } from '@/domains/media/utils/uploadValidation';

/** 업로드 실패를 단계에 맞는 짧은 안내로 바꾼다. 업로드 체인 밖의 오류는 화면마다 다른 fallback을 쓴다. */
export const describeUploadError = (error: unknown, fallback: string): string => {
    if (!(error instanceof UploadChainError)) return fallback;
    switch (error.stage) {
        case 'prepare':
            return '업로드 준비에 실패했어요';
        // 서버가 형식·용량으로 거부했으면 업로드 전 검증과 같은 말로 알린다
        case 'presign':
            if (!error.rejectReason) return '업로드 준비에 실패했어요';
            if (error.rejectReason === 'invalid_request')
                return '올릴 수 없는 사진이 섞여 있어 업로드를 시작하지 못했어요';
            return `${REJECT_REASON_LABEL[error.rejectReason]} 사진이 있어 올리지 못했어요`;
        case 's3':
            return error.failedCount > 0 ? `${error.failedCount}장을 올리지 못했어요` : fallback;
        case 'register':
            return error.failedCount > 0 ? `${error.failedCount}장 등록에 실패했어요` : fallback;
        // 사진은 모두 올라갔고 그 뒤의 여행 상태 전환이 실패했다
        case 'post_task':
            return '사진 업로드를 마무리하지 못했어요';
        default:
            return fallback;
    }
};

/** 진행 중인 업로드의 한 줄 안내. 진행 중이 아니면 null이라 호출부가 자기 화면의 문구로 이어 쓴다. */
export const describeUploadProgress = (phase: UploadPhase, stats: UploadStats): string | null => {
    switch (phase) {
        case 'preparing':
            return '업로드 준비 중…';
        case 'uploading':
            return `사진 업로드 중 ${stats.succeeded}/${stats.total}장${stats.failed > 0 ? ` · 실패 ${stats.failed}` : ''}`;
        case 'registering':
            return '사진 등록 중…';
        case 'finalizing':
            return '마무리 중…';
        default:
            return null;
    }
};

/** 사진 관리 화면의 '위치 정보 없음' 카드로 모이는 사진이 있을 때의 안내. 없으면 null. */
export const describeWithoutLocation = (count: number): string | null =>
    count > 0 ? `${count}장은 위치 정보가 없어 '위치 정보 없음'에 모아둘게요` : null;

/** 서버가 이미 있다고 알려 와 올리지 않은 사진이 있을 때의 안내. 없으면 null. */
export const describeDuplicates = (count: number): string | null => (count > 0 ? `${count}장은 이미 있어요` : null);

/** 재처리 결과 안내. 원본이 없는 사진은 다시 처리할 수 없어 삭제 후 다시 올려야 한다. */
export const describeReprocessResult = ({
    restarted,
    sourceMissing,
    requestFailed,
}: ReprocessSummary): string | null => {
    if (sourceMissing > 0) return `${sourceMissing}장은 원본이 없어 다시 처리할 수 없어요. 삭제한 뒤 다시 올려 주세요`;
    if (requestFailed) return '다시 처리하지 못했어요. 잠시 후 다시 시도해 주세요';
    if (restarted > 0) return '다시 처리하고 있어요';
    return null;
};
