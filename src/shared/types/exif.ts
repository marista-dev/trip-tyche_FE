// EXIF 데이터 구조 (libs/utils/exif가 exifr 결과를 이 모양으로 옮긴다)
// 각 IFD(Image File Directory)는 태그 번호를 키로 사용
// 값 타입: 문자열, 숫자, 유리수(숫자 또는 [분자, 분모] 튜플), 유리수 배열 등
type IfdData = Record<number, string | number | number[] | [number, number][]>;

export interface Exif {
    '0th'?: IfdData;
    Exif?: IfdData;
    GPS?: IfdData;
    '1st'?: IfdData;
    Interop?: IfdData;
    thumbnail?: string | Uint8Array | null;
}
