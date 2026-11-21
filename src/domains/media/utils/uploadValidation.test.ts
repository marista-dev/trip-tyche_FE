import { describe, it, expect } from 'vitest';

import {
    MAX_UPLOAD_FILE_BYTES,
    MAX_UPLOAD_FILES,
    describeExcluded,
    validateUploadFiles,
    withSupportedExtension,
    type UploadRejectReason,
} from './uploadValidation';

// 50MB짜리 Blob을 실제로 만들면 느리므로 size만 덮어쓴다.
const makeFile = (name: string, type: string, size = 10) => {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
};

const none: Record<UploadRejectReason, number> = { unsupported_format: 0, empty: 0, too_large: 0, over_limit: 0 };

describe('validateUploadFiles', () => {
    it('accepts jpeg, jpg, png, heic, heif, webp by MIME type', () => {
        const files = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp'].map(
            (type, i) => makeFile(`photo${i}.${type.split('/')[1]}`, type),
        );

        const { accepted, rejected } = validateUploadFiles(files);

        expect(accepted).toEqual(files);
        expect(rejected).toEqual(none);
    });

    it('falls back to the extension when type is empty or generic', () => {
        const files = [
            makeFile('IMG_0001.HEIC', ''),
            makeFile('IMG_0002.jpeg', 'application/octet-stream'),
            makeFile('IMG_0003.webp', ''),
        ];

        expect(validateUploadFiles(files).accepted).toEqual(files);
    });

    it('rejects empty-type files whose extension is not supported', () => {
        const { accepted, rejected } = validateUploadFiles([makeFile('notes.pdf', ''), makeFile('noext', '')]);

        expect(accepted).toEqual([]);
        expect(rejected.unsupported_format).toBe(2);
    });

    it('trusts a specific MIME type over the extension', () => {
        // 이미지 확장자를 달았어도 type이 명시적으로 다른 형식이면 믿지 않는다
        const { accepted, rejected } = validateUploadFiles([
            makeFile('fake.jpg', 'video/mp4'),
            makeFile('anim.heic', 'image/gif'),
        ]);

        expect(accepted).toEqual([]);
        expect(rejected.unsupported_format).toBe(2);
    });

    it('rejects unsupported image formats', () => {
        const { rejected } = validateUploadFiles([
            makeFile('a.gif', 'image/gif'),
            makeFile('b.bmp', 'image/bmp'),
            makeFile('c.svg', 'image/svg+xml'),
        ]);

        expect(rejected.unsupported_format).toBe(3);
    });

    it('rejects files over the size limit but accepts exactly the limit', () => {
        const atLimit = makeFile('ok.jpg', 'image/jpeg', MAX_UPLOAD_FILE_BYTES);
        const overLimit = makeFile('big.jpg', 'image/jpeg', MAX_UPLOAD_FILE_BYTES + 1);

        const { accepted, rejected } = validateUploadFiles([atLimit, overLimit]);

        expect(accepted).toEqual([atLimit]);
        expect(rejected.too_large).toBe(1);
    });

    it('counts an unsupported and oversized file only as unsupported_format', () => {
        const { rejected } = validateUploadFiles([makeFile('big.gif', 'image/gif', MAX_UPLOAD_FILE_BYTES + 1)]);

        expect(rejected).toEqual({ ...none, unsupported_format: 1 });
    });

    it('moves files beyond the limit to over_limit, keeping input order for the rest', () => {
        const files = Array.from({ length: 5 }, (_, i) => makeFile(`p${i}.jpg`, 'image/jpeg'));

        const { accepted, rejected } = validateUploadFiles(files, { maxFiles: 3 });

        expect(accepted).toEqual(files.slice(0, 3));
        expect(rejected.over_limit).toBe(2);
    });

    it('applies the file limit after format and size filtering', () => {
        const bad = makeFile('x.gif', 'image/gif');
        const big = makeFile('big.jpg', 'image/jpeg', MAX_UPLOAD_FILE_BYTES + 1);
        const good = Array.from({ length: 3 }, (_, i) => makeFile(`p${i}.jpg`, 'image/jpeg'));

        const { accepted, rejected } = validateUploadFiles([bad, good[0], big, good[1], good[2]], { maxFiles: 2 });

        expect(accepted).toEqual([good[0], good[1]]);
        expect(rejected).toEqual({ ...none, unsupported_format: 1, too_large: 1, over_limit: 1 });
    });

    it('defaults the limit to MAX_UPLOAD_FILES', () => {
        const files = Array.from({ length: MAX_UPLOAD_FILES + 2 }, (_, i) => makeFile(`p${i}.jpg`, 'image/jpeg'));

        const { accepted, rejected } = validateUploadFiles(files);

        expect(accepted).toHaveLength(MAX_UPLOAD_FILES);
        expect(rejected.over_limit).toBe(2);
    });

    it('does not dedupe identical files', () => {
        const a = makeFile('same.jpg', 'image/jpeg');
        const b = makeFile('same.jpg', 'image/jpeg');

        expect(validateUploadFiles([a, b]).accepted).toHaveLength(2);
    });

    it('handles an empty input', () => {
        expect(validateUploadFiles([])).toEqual({ accepted: [], rejected: none });
    });
});

describe('describeExcluded', () => {
    it('returns null when nothing was excluded', () => {
        expect(describeExcluded(none)).toBeNull();
        expect(describeExcluded(none, 0)).toBeNull();
    });

    it('summarizes every reason in one sentence', () => {
        expect(describeExcluded({ unsupported_format: 1, empty: 1, too_large: 1, over_limit: 0 }, 2)).toBe(
            '영상·녹음 2개, 지원하지 않는 형식 1장, 빈 파일 1장, 50MB 초과 1장은 제외했어요.',
        );
    });

    it('mentions the 300 limit only when over_limit > 0', () => {
        expect(describeExcluded({ ...none, over_limit: 4 })).toBe(
            '한도 초과 4장은 제외했어요. 한 번에 최대 300장까지 올릴 수 있어요.',
        );
        expect(describeExcluded({ ...none, too_large: 1 })).not.toContain('300');
    });

    it('includes the over_limit part together with the others', () => {
        expect(describeExcluded({ ...none, too_large: 1, over_limit: 2 }, 1)).toBe(
            '영상·녹음 1개, 50MB 초과 1장, 한도 초과 2장은 제외했어요. 한 번에 최대 300장까지 올릴 수 있어요.',
        );
    });

    it('reports skipped non-image files on their own', () => {
        expect(describeExcluded(none, 3)).toBe('영상·녹음 3개는 제외했어요.');
    });
});

describe('withSupportedExtension', () => {
    it('지원 형식인데 확장자가 없거나 엉뚱하면 형식에 맞는 확장자를 붙인다', () => {
        const noExtension = withSupportedExtension(
            new File(['abc'], 'IMG_0001', { type: 'image/jpeg', lastModified: 5 }),
        );
        const oddExtension = withSupportedExtension(new File(['abc'], 'photo.gif', { type: 'image/heic' }));

        expect(noExtension.name).toBe('IMG_0001.jpg');
        expect(noExtension).toMatchObject({ type: 'image/jpeg', size: 3, lastModified: 5 });
        expect(oddExtension.name).toBe('photo.gif.heic');
    });

    it('이미 맞는 확장자거나 형식을 모르면 그대로 둔다', () => {
        const named = new File(['x'], 'a.JPG', { type: 'image/jpeg' });
        const unknown = new File(['x'], 'blob', { type: '' });

        expect(withSupportedExtension(named)).toBe(named);
        expect(withSupportedExtension(unknown)).toBe(unknown);
    });

    it('검증은 확장자를 요구한다. 보정을 거치면 통과한다', () => {
        const bare = makeFile('IMG_0001', 'image/jpeg');

        expect(validateUploadFiles([bare]).rejected.unsupported_format).toBe(1);
        expect(validateUploadFiles([withSupportedExtension(bare)]).accepted).toHaveLength(1);
    });
});

describe('서버가 요청 전체를 거부하는 값', () => {
    it('0바이트 파일은 빈 파일로 뺀다', () => {
        const { accepted, rejected } = validateUploadFiles([
            makeFile('a.jpg', 'image/jpeg', 0),
            makeFile('b.jpg', 'image/jpeg'),
        ]);

        expect(accepted.map((f) => f.name)).toEqual(['b.jpg']);
        expect(rejected).toEqual({ ...none, empty: 1 });
    });

    it('255자를 넘는 이름은 확장자를 두고 앞을 줄인다. 빼지는 않는다', () => {
        const longNamed = withSupportedExtension(new File(['x'], `${'가'.repeat(300)}.HEIC`, { type: 'image/heic' }));
        const longBare = withSupportedExtension(new File(['x'], 'b'.repeat(300), { type: 'image/jpeg' }));

        expect(longNamed.name).toHaveLength(255);
        expect(longNamed.name.endsWith('가.HEIC')).toBe(true);
        expect(longBare.name).toBe(`${'b'.repeat(251)}.jpg`);
        expect(validateUploadFiles([longNamed, longBare]).accepted).toHaveLength(2);
    });
});
