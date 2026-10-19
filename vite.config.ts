import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '0.0.0.0', port: parseInt(process.env.WEB_PORT || '3110', 10) },
  preview: { host: '0.0.0.0', port: parseInt(process.env.WEB_PORT || '3110', 10), allowedHosts: true },
})
