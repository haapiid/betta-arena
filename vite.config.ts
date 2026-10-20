import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const port = parseInt(env.WEB_PORT || '3110', 10)
  // Dev only: send /api to a running engine when ENGINE_URL is set (e.g. ENGINE_URL=http://127.0.0.1:5050 in .env).
  // Without it there is no proxy, the site finds no engine and shows its demo, and the terminal stays quiet.
  // In production nginx (or the host) sends /api to the engine.
  const proxy = env.ENGINE_URL ? { '/api': { target: env.ENGINE_URL, changeOrigin: true } } : undefined
  const siteUrl = (env.SITE_URL || '').replace(/\/$/, '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // absolute link-preview URLs need the site's address; without it the preview tags are left out
        name: 'site-url',
        transformIndexHtml: (html: string) =>
          siteUrl ? html.replaceAll('%SITE_URL%', siteUrl) : html.replace(/\s*<meta[^>]*%SITE_URL%[^>]*>/g, ''),
      },
    ],
    define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) },
    server: { host: '0.0.0.0', port, proxy },
    preview: { host: '0.0.0.0', port, allowedHosts: true },
  }
})
