import type { MediaFileItem } from '@/domains/media/types';

export function selectDisplayUrl(item: MediaFileItem): string {
    if (item.status === 'LEGACY') return item.currentUrl;
    if (item.status === 'PROCESSED') return item.finalUrl;
    return item.currentUrl;
}
