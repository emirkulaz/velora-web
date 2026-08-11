import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const backendTarget = process.env.VELORA_API_TARGET ?? 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        globIgnores: [
          '**/trikomex-textile-operations-hero.png',
          '**/demo/**',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // ERP API / JWT — asla cache’lenmez, sahte offline veri yok
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
    // Trikomex LAN: diğer PC’ler http://<bu-makine-IP>:5173 açabilsin
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
  },
})
