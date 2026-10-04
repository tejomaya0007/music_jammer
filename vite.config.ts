import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Local/test backend (server/start.ts). Only used when VITE_BACKEND=mock.
const mockProxy = { '/mock-api': { target: 'http://127.0.0.1:8787', changeOrigin: false } };

// the real-YouTube dev mode is served over HTTPS: YouTube refuses to embed players for plain-http LAN addresses (error 150)
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'mock-real' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: '/',
        name: 'Jam Room',
        short_name: 'Jam Room',
        description: 'Listen to YouTube together, in sync.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e0d0b',
        theme_color: '#0e0d0b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, strictPort: false, proxy: mockProxy },
  preview: { port: 4173, strictPort: true, proxy: mockProxy },
  build: { target: 'es2020', sourcemap: true },
}));
