export function translateFailureReason(reason: string | null | undefined): string {
    if (!reason) return '알 수 없는 오류가 발생했습니다';
    if (reason.includes('corrupted')) return '손상된 이미지입니다';
    if (reason.includes('format')) return '지원하지 않는 형식입니다';
    if (reason.includes('size')) return '이미지가 너무 큽니다';
    return '처리 중 오류가 발생했습니다';
}
