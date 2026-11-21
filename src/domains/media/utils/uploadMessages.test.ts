import { describe, expect, it, vi } from 'vitest';

import { UploadChainError } from '@/domains/media/utils/uploadChain';
import {
    describeDuplicates,
    describeReprocessResult,
    describeUploadError,
    describeUploadProgress,
    describeWithoutLocation,
} from '@/domains/media/utils/uploadMessages';

vi.mock('react-router-dom', () => ({ useParams: () => ({}) }));
vi.mock('@/libs/apis', () => ({ mediaAPI: {} }));
vi.mock('@/libs/apis/media', () => ({ isDirectS3Upload: () => false }));

const FALLBACK = '다시 시도해 주세요';

describe('describeUploadError', () => {
    it('단계마다 다른 안내를 고른다', () => {
        expect(describeUploadError(new UploadChainError('prepare', 5, 'x'), FALLBACK)).toBe('업로드 준비에 실패했어요');
        expect(describeUploadError(new UploadChainError('presign', 5, 'x'), FALLBACK)).toBe('업로드 준비에 실패했어요');
        expect(describeUploadError(new UploadChainError('s3', 3, 'x'), FALLBACK)).toBe('3장을 올리지 못했어요');
        expect(describeUploadError(new UploadChainError('register', 50, 'x'), FALLBACK)).toBe('50장 등록에 실패했어요');
        // 사진 전송·등록은 끝났으므로 '업로드 실패'로 말하지 않는다
        expect(describeUploadError(new UploadChainError('post_task', 0, 'x'), FALLBACK)).toBe(
            '사진 업로드를 마무리하지 못했어요',
        );
    });

    it('장수 없는 실패와 체인 밖의 오류는 fallback이다', () => {
        expect(describeUploadError(new UploadChainError('s3', 0, 'x'), FALLBACK)).toBe(FALLBACK);
        expect(describeUploadError(new Error('boom'), FALLBACK)).toBe(FALLBACK);
        expect(describeUploadError(undefined, FALLBACK)).toBe(FALLBACK);
    });
});

describe('describeUploadProgress', () => {
    const stats = { total: 121, succeeded: 37, failed: 0 };

    it('전송 중에는 장수를, 그 밖의 진행 단계는 단계 이름을 보여 준다', () => {
        expect(describeUploadProgress('uploading', stats)).toBe('사진 업로드 중 37/121장');
        expect(describeUploadProgress('uploading', { ...stats, failed: 2 })).toBe('사진 업로드 중 37/121장 · 실패 2');
        expect(describeUploadProgress('preparing', stats)).toBe('업로드 준비 중…');
        expect(describeUploadProgress('registering', stats)).toBe('사진 등록 중…');
        expect(describeUploadProgress('finalizing', stats)).toBe('마무리 중…');
    });

    it('진행 중이 아니면 null이다', () => {
        expect(describeUploadProgress('idle', stats)).toBeNull();
        expect(describeUploadProgress('done', stats)).toBeNull();
        expect(describeUploadProgress('failed', stats)).toBeNull();
    });
});

describe('describeWithoutLocation', () => {
    it('위치 없는 사진이 있을 때만 안내한다', () => {
        expect(describeWithoutLocation(0)).toBeNull();
        expect(describeWithoutLocation(3)).toBe("3장은 위치 정보가 없어 '위치 정보 없음'에 모아둘게요");
    });
});

describe('서버 거부·중복·재처리 안내', () => {
    it('presign이 형식·용량으로 거부하면 업로드 전 검증과 같은 말로 알린다', () => {
        const unsupported = new UploadChainError('presign', 2, 'x', { rejectReason: 'unsupported_format' });
        const tooLarge = new UploadChainError('presign', 2, 'x', { rejectReason: 'too_large' });
        expect(describeUploadError(unsupported, FALLBACK)).toBe('지원하지 않는 형식 사진이 있어 올리지 못했어요');
        expect(describeUploadError(tooLarge, FALLBACK)).toBe('50MB 초과 사진이 있어 올리지 못했어요');
        const invalid = new UploadChainError('presign', 2, 'x', { rejectReason: 'invalid_request' });
        expect(describeUploadError(invalid, FALLBACK)).toBe('올릴 수 없는 사진이 섞여 있어 업로드를 시작하지 못했어요');
    });

    it('이미 있는 사진 수를 알린다', () => {
        expect(describeDuplicates(0)).toBeNull();
        expect(describeDuplicates(3)).toBe('3장은 이미 있어요');
    });

    it('원본이 없는 사진은 삭제 후 다시 올리라고 먼저 알린다', () => {
        expect(describeReprocessResult({ restarted: 2, sourceMissing: 1, requestFailed: true })).toBe(
            '1장은 원본이 없어 다시 처리할 수 없어요. 삭제한 뒤 다시 올려 주세요',
        );
        expect(describeReprocessResult({ restarted: 0, sourceMissing: 0, requestFailed: true })).toBe(
            '다시 처리하지 못했어요. 잠시 후 다시 시도해 주세요',
        );
        expect(describeReprocessResult({ restarted: 2, sourceMissing: 0, requestFailed: false })).toBe(
            '다시 처리하고 있어요',
        );
        expect(describeReprocessResult({ restarted: 0, sourceMissing: 0, requestFailed: false })).toBeNull();
    });
});
