/// <reference types="vitest/config" />
import fs from 'fs';
import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type UserConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const KEY_PATH = 'certificates/local.triptychetest.shop-key.pem';
const CERT_PATH = 'certificates/local.triptychetest.shop.pem';

type ViteConfigWithTest = UserConfig & { test?: Record<string, unknown> };

const baseConfig: ViteConfigWithTest = {
    plugins: [
        react({
            jsxImportSource: '@emotion/react',
            babel: {
                plugins: ['@emotion/babel-plugin'],
            },
        }),
        tsconfigPaths(),
        visualizer({
            open: process.env.CI !== 'true',
            gzipSize: true,
        }),
    ],
    resolve: {
        alias: [{ find: '@', replacement: resolve(__dirname, 'src') }],
    },
    optimizeDeps: {
        include: ['@emotion/react'],
    },
    build: {
        target: 'esnext',
        minify: 'esbuild',
        sourcemap: false,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
    define: {
        global: 'window',
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        css: false,
    },
};

export default defineConfig(({ command }) => {
    if (command === 'serve') {
        return {
            ...baseConfig,
            server: {
                port: 3000,
                host: '0.0.0.0',
                https: getHttpsConfig(),
            },
        } as UserConfig;
    }

    return {
        ...baseConfig,
        preview: {
            port: 4173,
            host: '0.0.0.0',
        },
    };
});

function getHttpsConfig() {
    try {
        if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
            return {
                key: fs.readFileSync(KEY_PATH),
                cert: fs.readFileSync(CERT_PATH),
            };
        }
    } catch (error) {
        console.log('HTTPS certificates not found, using HTTP');
    }
    return undefined;
}
