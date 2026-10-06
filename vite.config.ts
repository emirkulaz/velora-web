import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execFileSync } from 'node:child_process'

const backendTarget = process.env.VELORA_API_TARGET ?? 'http://127.0.0.1:3001'
let thisVersion = { commitSha: '', buildTime: '', environment: '', service: 'vexor-web' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vexor-build-version',
      apply: 'build',
      config() {
        const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
        if (!/^[a-f0-9]{40}$/.test(commitSha)) throw new Error('A verified Git commit SHA is required to build the Web.')
        thisVersion = { commitSha, buildTime: new Date().toISOString(), environment: process.env.RAILWAY_ENVIRONMENT_NAME || 'production', service: 'vexor-web' }
      },
      transformIndexHtml() {
        return [{ tag: 'meta', attrs: { name: 'vexor-build-sha', content: thisVersion.commitSha }, injectTo: 'head' }]
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(thisVersion) + '\n' })
      },
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'VEXOR',
        short_name: 'VEXOR',
        description: 'VEXOR — üretim işletmeleri için AI-first ERP',
        lang: 'tr',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        id: '/',
        theme_color: '#1a2332',
        background_color: '#1a2332',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cacheId: 'vexor-production',
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/version\.json$/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        globIgnores: [
          '**/demo/**',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  envPrefix: ['VITE_', 'ENABLE_DEMO_MODE'],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['erpvexor.com'],
  },
})
