import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // the engine's API; in production nginx (or the host) sends /api to it
  server: { host: '0.0.0.0', port: parseInt(process.env.WEB_PORT || '3110', 10), proxy: { '/api': { target: process.env.ENGINE_URL || 'http://127.0.0.1:5050', changeOrigin: true } } },
  preview: { host: '0.0.0.0', port: parseInt(process.env.WEB_PORT || '3110', 10), allowedHosts: true },
})
