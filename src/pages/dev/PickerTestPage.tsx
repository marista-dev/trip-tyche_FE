import { useRef, useState } from 'react';

import { css } from '@emotion/react';
import { parse as parseExif } from 'exifr';

import { getActualFileType } from '@/libs/utils/image';

/*
 * iOS 사진 선택 창 멈춤 진단 페이지 (프리뷰 전용, main에 머지하지 않는다).
 *
 * 같은 사진들을 두 가지 accept로 골라 비교한다.
 *  - A: 지금 업로드 화면과 같은 'image/*,image/heic,image/heif'
 *  - B: 'image/*'만 — WebKit은 accept가 이미지 종류를 제한하지 않으면 JPEG 변환을 건너뛴다(bug 267277)
 * 기록: 탭 → change 이벤트까지 시간, 실제 파일 형식(매직 바이트), 크기, EXIF GPS·촬영 시각 유무.
 * 탭 → change에는 사진을 고르는 시간도 들어가므로, 두 번 모두 같은 사진을 같은 방식으로 빠르게 고를 것.
 */

const VARIANTS = {
    A: 'image/*,image/heic,image/heif',
    B: 'image/*',
} as const;
type Variant = keyof typeof VARIANTS;

interface Result {
    variant: Variant;
    accept: string;
    count: number;
    pickMs: number;
    types: Record<string, number>;
    totalMB: number;
    maxMB: number;
    withGps: number;
    withDate: number;
    exifMs: number;
    /** 파일 이름 확장자별 개수(원본 JPG/HEIC인지, 변환된 jpeg인지 가늠) */
    extensions: Record<string, number>;
    /** 해상도(메가픽셀)별 개수 */
    resolutions: Record<string, number>;
    software: Record<string, number>;
}

const readExif = async (file: File) => {
    try {
        // GPS·촬영 시각만, 파일 앞부분만 읽는다(HEIC·JPEG 모두)
        // latitude/longitude는 exifr가 원본 GPS 태그로 계산하는 값이라, pick에는 원본 태그를 넣어야 한다
        const data = await parseExif(file, {
            pick: [
                'DateTimeOriginal',
                'GPSLatitude',
                'GPSLatitudeRef',
                'GPSLongitude',
                'GPSLongitudeRef',
                'ExifImageWidth',
                'ExifImageHeight',
                'Software',
            ],
        });
        const w = data?.ExifImageWidth;
        const h = data?.ExifImageHeight;
        return {
            gps: typeof data?.latitude === 'number' && typeof data?.longitude === 'number',
            date: !!data?.DateTimeOriginal,
            megapixels: typeof w === 'number' && typeof h === 'number' ? Math.round((w * h) / 1e5) / 10 : null,
            software: typeof data?.Software === 'string' ? data.Software : null,
        };
    } catch {
        return { gps: false, date: false, megapixels: null, software: null };
    }
};

const PickerTestPage = () => {
    const [results, setResults] = useState<Result[]>([]);
    const [busy, setBusy] = useState<Variant | null>(null);
    const startedAt = useRef<Record<Variant, number>>({ A: 0, B: 0 });

    const onPick = (variant: Variant) => async (e: React.ChangeEvent<HTMLInputElement>) => {
        const pickMs = Math.round(performance.now() - startedAt.current[variant]);
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (!files.length) return;
        setBusy(variant);

        const types: Record<string, number> = {};
        let withGps = 0;
        let withDate = 0;
        const extensions: Record<string, number> = {};
        const resolutions: Record<string, number> = {};
        const software: Record<string, number> = {};
        const bump = (map: Record<string, number>, key: string) => (map[key] = (map[key] ?? 0) + 1);
        const exifStart = performance.now();
        for (const file of files) {
            const actual = await getActualFileType(file);
            const key = `${actual} (${file.type || '없음'})`;
            types[key] = (types[key] ?? 0) + 1;
            const exif = await readExif(file);
            if (exif.gps) withGps++;
            if (exif.date) withDate++;
            bump(extensions, file.name.includes('.') ? (file.name.split('.').pop() ?? '') : '(없음)');
            bump(resolutions, exif.megapixels === null ? '?' : `${exif.megapixels}MP`);
            bump(software, exif.software ?? '?');
        }
        const sizes = files.map((f) => f.size / 1e6);
        setResults((prev) => [
            ...prev,
            {
                variant,
                accept: VARIANTS[variant],
                count: files.length,
                pickMs,
                types,
                totalMB: Math.round(sizes.reduce((a, b) => a + b, 0) * 10) / 10,
                maxMB: Math.round(Math.max(...sizes) * 10) / 10,
                withGps,
                withDate,
                exifMs: Math.round(performance.now() - exifStart),
                extensions,
                resolutions,
                software,
            },
        ]);
        setBusy(null);
    };

    const fmt = (map: Record<string, number>) =>
        Object.entries(map)
            .map(([k, v]) => `${k}×${v}`)
            .join(', ');

    const summary = results
        .map(
            (r) =>
                `[${r.variant}] accept=${r.accept} | ${r.count}장 | 탭→수신 ${(r.pickMs / 1000).toFixed(1)}초 | ` +
                `형식 ${Object.entries(r.types)
                    .map(([k, v]) => `${k}×${v}`)
                    .join(
                        ', ',
                    )} | 확장자 ${fmt(r.extensions)} | 해상도 ${fmt(r.resolutions)} | Software ${fmt(r.software)} | 합계 ${r.totalMB}MB(최대 ${r.maxMB}MB) | GPS ${r.withGps}/${r.count} | ` +
                `촬영시각 ${r.withDate}/${r.count} | EXIF 읽기 ${r.exifMs}ms`,
        )
        .join('\n');

    return (
        <div css={page}>
            <h1 css={title}>사진 선택 창 진단</h1>
            <p css={desc}>
                오늘 찍지 않은 같은 사진들(예: 30장)을 B → A 순서로 한 번씩 골라 주세요. 고르는 방식(앨범, 순서)도
                똑같이 해 주세요. ✓를 누른 뒤 선택 창이 닫힐 때까지 기다리면 결과가 아래에 나옵니다.
            </p>
            {(Object.keys(VARIANTS) as Variant[]).map((v) => (
                <label key={v} css={button} onClick={() => (startedAt.current[v] = performance.now())}>
                    <input type='file' multiple accept={VARIANTS[v]} css={hidden} onChange={onPick(v)} />
                    {v}. accept=&quot;{VARIANTS[v]}&quot;
                </label>
            ))}
            {busy && <p css={desc}>{busy} 결과 분석 중…</p>}
            {results.length > 0 && (
                <>
                    <pre css={pre}>{summary}</pre>
                    <button
                        css={button}
                        onClick={() => navigator.clipboard?.writeText(`${navigator.userAgent}\n${summary}`)}
                    >
                        결과 복사
                    </button>
                </>
            )}
        </div>
    );
};

const page = css`
    padding: 24px 20px 80px;
    font-size: 15px;
    line-height: 1.5;
`;
const title = css`
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 8px;
`;
const desc = css`
    color: #475569;
    margin-bottom: 16px;
`;
const button = css`
    display: block;
    width: 100%;
    padding: 16px;
    margin-bottom: 12px;
    border-radius: 12px;
    background: #0066ff;
    color: #fff;
    font-weight: 600;
    text-align: center;
    word-break: break-all;
`;
const hidden = css`
    display: none;
`;
const pre = css`
    white-space: pre-wrap;
    word-break: break-all;
    background: #f1f5f9;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 12px;
`;

export default PickerTestPage;
