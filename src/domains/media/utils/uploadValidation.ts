/** empty = 0바이트. 서버가 크기 0을 받지 않아 presign 요청 전체가 거부된다. */
export type UploadRejectReason = 'unsupported_format' | 'empty' | 'too_large' | 'over_limit';

export const MAX_UPLOAD_FILES = 300;
export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
// 서버가 받는 파일명 최대 길이. 넘으면 presign 요청 전체가 거부된다.
const MAX_FILE_NAME_LENGTH = 255;

export interface UploadValidationResult {
    accepted: File[];
    rejected: Record<UploadRejectReason, number>;
}

/** 네이티브 피커가 검증 전에 알려 온 것. 토스트가 하나뿐이라 제외 안내와 한 문장으로 합쳐 띄운다. */
export interface PickerReport {
    /** 영상·녹음 등 이미지가 아니라 피커가 먼저 버린 선택 수 */
    skippedNonImage?: number;
    /** 위치 권한 안내 등 */
    notice?: string | null;
}

const SUPPORTED_MIME = /^image\/(jpe?g|png|heic|heif|webp)$/i;
const SUPPORTED_EXTENSION = /\.(jpe?g|png|heic|heif|webp)$/i;

// 웹 input은 HEIC의 type을 비워 보내는 경우가 많다. 이때만 확장자를 믿는다.
export const isGenericType = (type: string) => type === '' || type === 'application/octet-stream';

/*
 * 서버는 확장자로 형식을 판정하고 객체 키에도 쓴다. 지원하는 형식인데 이름에 확장자가 없거나 엉뚱하면
 * presign 요청 전체가 거부돼 재시도해도 계속 실패한다. 그래서 형식에 맞는 확장자를 이름 끝에 붙인다.
 * 이름이 서버 상한보다 길면 같은 이유로 거부되므로, 확장자는 두고 앞부분을 줄인다.
 */
export const withSupportedExtension = (file: File): File => {
    const existing = SUPPORTED_EXTENSION.exec(file.name)?.[1];
    const subtype = SUPPORTED_MIME.exec(file.type)?.[1].toLowerCase();
    const extension = existing ?? (subtype === 'jpeg' ? 'jpg' : subtype);
    // 형식을 알 수 없으면 그대로 둔다. 검증이 지원하지 않는 형식으로 거른다.
    if (!extension) return file;
    const base = existing ? file.name.slice(0, -(existing.length + 1)) : file.name;
    const name = `${base.slice(0, MAX_FILE_NAME_LENGTH - extension.length - 1)}.${extension}`;
    if (name === file.name) return file;
    return new File([file], name, { type: file.type, lastModified: file.lastModified });
};

// withSupportedExtension을 거친 파일을 본다. 서버가 확장자로 거부하므로 확장자는 늘 있어야 한다.
const isSupportedFormat = (file: File) =>
    SUPPORTED_EXTENSION.test(file.name) && (isGenericType(file.type) || SUPPORTED_MIME.test(file.type));

/**
 * 중복 제거·확장자 보정은 하지 않는다(호출부가 withSupportedExtension을 먼저 거친다).
 * 형식·빈 파일·용량 → 장수 순으로 거르며 accepted는 입력 순서를 따른다.
 */
export const validateUploadFiles = (
    files: readonly File[],
    options?: { maxFiles?: number },
): UploadValidationResult => {
    const maxFiles = options?.maxFiles ?? MAX_UPLOAD_FILES;
    const accepted: File[] = [];
    const rejected: Record<UploadRejectReason, number> = {
        unsupported_format: 0,
        empty: 0,
        too_large: 0,
        over_limit: 0,
    };

    for (const file of files) {
        if (!isSupportedFormat(file)) {
            rejected.unsupported_format += 1;
        } else if (file.size === 0) {
            rejected.empty += 1;
        } else if (file.size > MAX_UPLOAD_FILE_BYTES) {
            rejected.too_large += 1;
        } else if (accepted.length >= maxFiles) {
            rejected.over_limit += 1;
        } else {
            accepted.push(file);
        }
    }

    return { accepted, rejected };
};

/** 제외 사유의 짧은 이름. 업로드 전 검증 안내와 서버 거부(presign) 안내가 같은 말을 쓰게 한다. */
export const REJECT_REASON_LABEL: Record<UploadRejectReason, string> = {
    unsupported_format: '지원하지 않는 형식',
    empty: '빈 파일',
    too_large: `${MAX_UPLOAD_FILE_BYTES / 1024 / 1024}MB 초과`,
    over_limit: '한도 초과',
};

/** 제외된 사진이 있을 때 토스트로 보여줄 한 문장. 없으면 null. skippedNonImage는 네이티브 피커가 먼저 버린 영상·녹음 수. */
export const describeExcluded = (rejected: Record<UploadRejectReason, number>, skippedNonImage = 0): string | null => {
    const parts: string[] = [];
    if (skippedNonImage > 0) parts.push(`영상·녹음 ${skippedNonImage}개`);
    (['unsupported_format', 'empty', 'too_large', 'over_limit'] as const).forEach((reason) => {
        if (rejected[reason] > 0) parts.push(`${REJECT_REASON_LABEL[reason]} ${rejected[reason]}장`);
    });

    if (parts.length === 0) return null;

    // 마지막 항목의 받침에 맞춘 조사. 영상·녹음만 있을 때 '개'로 끝난다.
    const particle = parts[parts.length - 1].endsWith('개') ? '는' : '은';
    const sentence = `${parts.join(', ')}${particle} 제외했어요.`;
    return rejected.over_limit > 0 ? `${sentence} 한 번에 최대 ${MAX_UPLOAD_FILES}장까지 올릴 수 있어요.` : sentence;
};
