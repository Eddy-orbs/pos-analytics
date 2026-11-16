/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// The app still reads CRA-style process.env.REACT_APP_* vars; map them via define so
// no source changes are needed. Absent vars become undefined so code-level defaults
// (rpcman RPC, hub.orbs.network subgraphs) kick in.
const CRA_VARS = [
    'REACT_APP_MAINNET_RPC',
    'REACT_APP_POLYGON_RPC',
    'REACT_APP_MAINNET_RPC_ALT',
    'REACT_APP_POLYGON_RPC_ALT',
    'REACT_APP_SUBGRAPH_ETH',
    'REACT_APP_SUBGRAPH_POLYGON',
    'REACT_APP_SUBGRAPH_ETH_ALT',
    'REACT_APP_SUBGRAPH_POLYGON_ALT',
    'REACT_APP_EVENT_CACHE',
    'REACT_APP_DELEGATIONS_SUBGRAPH_ETH',
    'REACT_APP_DELEGATIONS_SUBGRAPH_POLYGON',
    'REACT_APP_COINGECKO_API_KEY',
    'REACT_APP_COINGECKO_API_KEY_ALT'
];

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
    const define: Record<string, string> = {
        // '' matches CRA's PUBLIC_URL for a root-domain homepage (router basename uses it)
        'process.env.PUBLIC_URL': JSON.stringify(''),
        'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development')
    };
    for (const key of CRA_VARS) {
        define[`process.env.${key}`] = env[key] !== undefined ? JSON.stringify(env[key]) : 'undefined';
    }
    return {
        plugins: [
            react({ jsxRuntime: 'classic' }), // React 16 has no automatic JSX runtime
            tsconfigPaths()
        ],
        resolve: {
            // web3 1.x source needs a zoo of node polyfills in the browser; its dist
            // bundle is self-contained. In node (vitest) the source works natively and
            // the browser bundle does not (references `self`), so only alias for the app.
            // Phase 3 (viem) removes web3 entirely.
            alias: mode === 'test' ? undefined : { web3: 'web3/dist/web3.min.js' }
        },
        define,
        optimizeDeps: {
            esbuildOptions: {
                define: { global: 'globalThis' }
            }
        },
        css: {
            preprocessorOptions: {
                // CRA resolved @import 'scss/...' relative to src/
                scss: { includePaths: ['src'] }
            }
        },
        server: { port: 3001 },
        preview: {
            allowedHosts: ['analytics.orbs.kryp.xyz']
        },
        build: {
            outDir: 'build', // keep CRA's output dir so the gh-pages deploy script is unchanged
            sourcemap: false
        },
        test: {
            css: false,
            globals: true,
            environment: 'node',
            include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
        }
    };
});
