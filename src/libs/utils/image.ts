import { Dispatch, SetStateAction } from 'react';

import { MEDIA_FORMAT } from '@/domains/media/constants';
import { ClientImageFile } from '@/domains/media/types';
import { formatToISOLocal } from '@/libs/utils/date';
import { extractDateFromImage, extractLocationFromImage } from '@/libs/utils/exif';

// 중복 이미지 제거 (이름 기준). DataTransfer는 iOS Safari/일부 Android Chromium에서
// items.add()가 빈 FileList를 만들어버리는 버그가 있어 사용하지 않음. 단순 File[] 반환.
export const removeDuplicateImages = (images: File[]): File[] => {
    const imageMap = new Map<string, File>();
    images.forEach((image) => {
        imageMap.set(image.name, image);
    });
    return Array.from(imageMap.values());
};

// 이미지 메타데이터 추출
export const extractMetadataFromImage = async (
    images: readonly File[],
    onProgress?: Dispatch<SetStateAction<{ metadata: number; upload: number }>>,
): Promise<ClientImageFile[]> => {
    if (images.length === 0) return [];

    let process = 0;

    return await Promise.all(
        Array.from(images).map(async (image) => {
            const location = await extractLocationFromImage(image);
            const date = await extractDateFromImage(image);

            process++;

            if (onProgress) {
                const progressPercent = Math.round((process / images.length) * 100);
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
        }),
    );
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
