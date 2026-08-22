import { Capacitor } from '@capacitor/core';
import { FilePicker, type PickedFile } from '@capawesome/capacitor-file-picker';

import { runWithPool } from '@/libs/utils/async';

/*
 * 네이티브 갤러리에서 원본 이미지를 고른다.
 *
 * @capacitor/camera를 쓰지 않는 이유: 그쪽은 EXIF(특히 GPS)를 제거한다.
 * 이 앱은 사진의 EXIF GPS로 지도 핀을 찍으므로 원본 메타데이터 보존이 전부다.
 *
 * Android 10+는 content URI로 읽은 이미지의 위치 EXIF를 기본적으로 가린다(redact).
 * ACCESS_MEDIA_LOCATION 권한이 있어야 원본 그대로 읽힌다.
 */

// 한 번에 변환할 파일 수. 파일 전체를 Blob으로 읽으므로 동시에 너무 많이 열면 WebView 메모리가 터진다.
const FILE_CONVERSION_CONCURRENCY = 4;

/*
 * 위치 EXIF 접근 권한을 확보한다.
 * 거부되어도 예외를 던지지 않는다 — 좌표 없이 업로드되어 기존 '위치 미지정' 수동 지정 플로우로
 * 자연스럽게 이어지는 것이, 사진 선택 자체를 막는 것보다 낫다.
 */
export const ensureMediaLocationPermission = async (): Promise<boolean> => {
    try {
        const current = await FilePicker.checkPermissions();
        if (current.accessMediaLocation === 'granted') return true;

        const requested = await FilePicker.requestPermissions({ permissions: ['accessMediaLocation'] });
        return requested.accessMediaLocation === 'granted';
    } catch (error) {
        console.warn('위치 EXIF 권한 확인 실패: ', error);
        return false;
    }
};

/*
 * 네이티브가 돌려주는 것은 File이 아니라 파일 경로다.
 * readData 옵션으로 base64를 받는 방법도 있지만 대용량에서 앱이 죽으므로 쓰지 않고,
 * convertFileSrc로 WebView가 읽을 수 있는 URL을 만들어 Blob으로 가져온다.
 */
const toFile = async (picked: PickedFile): Promise<File | null> => {
    if (!picked.path) return null;

    try {
        const response = await fetch(Capacitor.convertFileSrc(picked.path));
        const blob = await response.blob();

        return new File([blob], picked.name, { type: picked.mimeType || blob.type });
    } catch (error) {
        console.error(`${picked.name} 파일 변환 실패: `, error);
        return null;
    }
};

export const pickImagesFromGallery = async (): Promise<File[]> => {
    await ensureMediaLocationPermission();

    // limit 0 = 무제한 다중 선택. readData는 기본값(false) 그대로 두어 base64 적재를 피한다.
    const { files } = await FilePicker.pickImages({ limit: 0 });

    const converted = await runWithPool(files, FILE_CONVERSION_CONCURRENCY, toFile);

    return converted.filter((file): file is File => file !== null);
};
