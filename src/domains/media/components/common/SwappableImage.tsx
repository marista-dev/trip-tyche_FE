import { useEffect, useRef, useState } from 'react';

import type { ProcessingStatus } from '@/domains/media/types';
import { DecodeQueue } from '@/domains/media/utils/DecodeQueue';

const decodeQueue = new DecodeQueue(4);

interface SwappableImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    currentUrl: string;
    finalUrl?: string;
    status: ProcessingStatus;
    alt?: string;
    onSwapped?: () => void;
}

export const SwappableImage = ({
    currentUrl,
    finalUrl,
    status,
    alt = '',
    onSwapped,
    loading = 'lazy',
    ...rest
}: SwappableImageProps) => {
    const isLegacy = status === 'LEGACY';

    const [displayUrl, setDisplayUrl] = useState(() => {
        if (isLegacy) return currentUrl;
        return status === 'PROCESSED' && finalUrl ? finalUrl : currentUrl;
    });

    const lastSwappedUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (isLegacy) return;
        if (status !== 'PROCESSED' || !finalUrl) return;
        if (lastSwappedUrlRef.current === finalUrl) return;

        let cancelled = false;

        decodeQueue.add(async () => {
            const img = new Image();
            img.src = finalUrl;
            try {
                if (typeof img.decode === 'function') {
                    await img.decode();
                } else {
                    await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve();
                        img.onerror = () => reject(new Error('image load failed'));
                    });
                }
                if (cancelled) return;
                lastSwappedUrlRef.current = finalUrl;
                setDisplayUrl(finalUrl);
                onSwapped?.();
            } catch (err) {
                if (cancelled) return;
                console.warn('[SwappableImage] decode failed, keeping currentUrl', { finalUrl, err });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [isLegacy, finalUrl, status, onSwapped]);

    return (
        <img
            src={displayUrl}
            alt={alt}
            loading={loading}
            onError={() => {
                console.warn('[SwappableImage] img onError', { displayUrl });
            }}
            {...rest}
        />
    );
};
