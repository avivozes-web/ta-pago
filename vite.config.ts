import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const APP_VERSION = new Date().toISOString()
function versionFile(): Plugin {
  return { name: 'version-file', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) }) } }
}
export default defineConfig({
  base: '/ta-pago/',
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    react(), versionFile(),
    VitePWA({
      registerType: 'autoUpdate', injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        name: 'Tá Pago!', short_name: 'Tá Pago!', description: 'Finanças, casa e rotina da Isa e do Hiago.', lang: 'pt-BR',
        start_url: '/ta-pago/', scope: '/ta-pago/', display: 'standalone', orientation: 'portrait',
        theme_color: '#F6F5F2', background_color: '#F6F5F2',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/ta-pago/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,ttf,woff2}'],
        cacheId: 'tapago-v3', cleanupOutdatedCaches: true, skipWaiting: true, clientsClaim: true,
        runtimeCaching: [
          { urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/.*/i, handler: 'NetworkOnly' },
          { urlPattern: /\/version\.json/, handler: 'NetworkOnly' },
        ],
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 5180 },
})
