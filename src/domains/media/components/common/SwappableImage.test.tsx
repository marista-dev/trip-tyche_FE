import { createElement } from 'react';

import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { describe, it, expect, afterEach } from 'vitest';

import { SwappableImage } from './SwappableImage';

let container: HTMLDivElement | null = null;

afterEach(() => {
    if (container) {
        document.body.removeChild(container);
        container = null;
    }
});

function renderToContainer(element: React.ReactElement): HTMLDivElement {
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        createRoot(container!).render(element);
    });
    return container;
}

describe('SwappableImage', () => {
    it('renders currentUrl directly for LEGACY status', () => {
        const el = renderToContainer(
            createElement(SwappableImage, { currentUrl: '/legacy.webp', status: 'LEGACY', alt: 'test' }),
        );
        const img = el.querySelector('img') as HTMLImageElement;
        expect(img.src).toContain('/legacy.webp');
    });

    it('renders finalUrl when initially PROCESSED with finalUrl', () => {
        const el = renderToContainer(
            createElement(SwappableImage, {
                currentUrl: '/thumb.webp',
                finalUrl: '/final.webp',
                status: 'PROCESSED',
                alt: 'test',
            }),
        );
        const img = el.querySelector('img') as HTMLImageElement;
        expect(img.src).toContain('/final.webp');
    });

    it('renders currentUrl when status is UPLOADED', () => {
        const el = renderToContainer(
            createElement(SwappableImage, {
                currentUrl: '/thumb.webp',
                finalUrl: '/final.webp',
                status: 'UPLOADED',
                alt: 'test',
            }),
        );
        const img = el.querySelector('img') as HTMLImageElement;
        expect(img.src).toContain('/thumb.webp');
    });
});
