var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/// <reference types="vitest/config" />
import fs from 'fs';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
var KEY_PATH = 'certificates/local.triptychetest.shop-key.pem';
var CERT_PATH = 'certificates/local.triptychetest.shop.pem';
var baseConfig = {
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
export default defineConfig(function (_a) {
    var command = _a.command;
    if (command === 'serve') {
        return __assign(__assign({}, baseConfig), { server: {
                port: 3000,
                host: '0.0.0.0',
                https: getHttpsConfig(),
            } });
    }
    return __assign(__assign({}, baseConfig), { preview: {
            port: 4173,
            host: '0.0.0.0',
        } });
});
function getHttpsConfig() {
    try {
        if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
            return {
                key: fs.readFileSync(KEY_PATH),
                cert: fs.readFileSync(CERT_PATH),
            };
        }
    }
    catch (error) {
        console.log('HTTPS certificates not found, using HTTP');
    }
    return undefined;
}
