import { Dispatch, SetStateAction } from 'react';

import { MEDIA_FORMAT } from '@/domains/media/constants';
import { ClientImageFile } from '@/domains/media/types';
import { runWithPool } from '@/libs/utils/async';
import { formatToISOLocal } from '@/libs/utils/date';
import { extractMetadataFromExif } from '@/libs/utils/exif';

// 중복 이미지 제거.
// 정확도: 파일명 단독 비교는 같은 이름의 다른 사진을 silent하게 잃을 수 있음 → name+size+lastModified
// 복합 키로 식별. 해시까지 필요할 정도로 정확하진 않아도 일반적인 갤러리 중복 선택 시나리오는 충분.
// DataTransfer는 iOS Safari/일부 Android Chromium에서 items.add()가 빈 FileList를 만들어버리는
// 버그가 있어 사용하지 않음. 단순 File[] 반환.
export const removeDuplicateImages = (images: File[]): File[] => {
    const imageMap = new Map<string, File>();
    images.forEach((image) => {
        const key = `${image.name}::${image.size}::${image.lastModified}`;
        if (!imageMap.has(key)) imageMap.set(key, image);
    });
    return Array.from(imageMap.values());
};

// 메타데이터 추출 단계의 동시성 상한. DecodeQueue의 기본값과 동일 — FileReader는 I/O 바운드라
// 4개면 처리량이 충분히 난다. 대량 업로드(수백 장)에서 base64 문자열이 한꺼번에 힙에 쌓이는 것을 막는다.
const METADATA_EXTRACTION_CONCURRENCY = 4;

// 이미지 메타데이터 추출.
// 파일당 EXIF를 정확히 1회만 읽고(extractMetadataFromExif), 동시에 시작되는 워커 수를
// METADATA_EXTRACTION_CONCURRENCY로 제한한다. runWithPool은 결과를 인덱스 위치에 직접 쓰므로
// 완료 순서가 뒤섞여도 반환 배열의 순서는 입력 순서(images)와 항상 동일하게 유지된다.
// ⚠️ 이 순서는 useImageUpload에서 presignedUrls/fileArray와 인덱스로 매칭되므로 절대 깨서는 안 된다.
export const extractMetadataFromImage = async (
    images: readonly File[],
    onProgress?: Dispatch<SetStateAction<{ metadata: number; upload: number }>>,
): Promise<ClientImageFile[]> => {
    if (images.length === 0) return [];

    let processed = 0;
    const fileList = Array.from(images);

    return runWithPool(fileList, METADATA_EXTRACTION_CONCURRENCY, async (image) => {
        const { location, date } = await extractMetadataFromExif(image);

        processed++;

        if (onProgress) {
            const progressPercent = Math.round((processed / fileList.length) * 100);
            onProgress((prev) => ({
                ...prev,
                metadata: progressPercent,
            }));
        }

        return {
            image,
            recordDate: formatToISOLocal(date),
            latitude: location?.latitude || 0,
            longitude: location?.longitude || 0,
        };
    });
};

// Heic -> jpeg 확장자 변경
export const convertHeicToJpg = async (images: FileList) => {
    const convertedImages = await Promise.all(
        Array.from(images).map(async (image) => {
            const actualType = await getActualFileType(image);
            if (actualType === 'image/heic') {
                const { default: heic2any } = await import('heic2any');

                const convertedBlob = await heic2any({
                    blob: image,
                    toType: 'image/jpeg',
                });

                const convertedFile = new File(
                    [convertedBlob as Blob],
                    image.name.replace(MEDIA_FORMAT.CURRENT_MEDIA_FORMAT, MEDIA_FORMAT.JPG_FORMAT),
                    { type: 'image/jpeg' },
                );
                return convertedFile;
            } else {
                return image;
            }
        }),
    );

    return convertedImages;
};

// 이미지 실제 타입 반환
const getActualFileType = async (file: File): Promise<string> => {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length >= 12) {
        const ftyp = String.fromCharCode(...bytes.slice(4, 8));
        if (ftyp === 'ftyp') {
            const brand = String.fromCharCode(...bytes.slice(8, 12));
            if (brand === 'heic' || brand === 'mif1' || brand === 'msf1') {
                return 'image/heic';
            }
        }
    }

    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }

    return file.type;
};
