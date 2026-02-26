import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
    port: 5174,
    open: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Technisch Beheer KPS',
        short_name: 'TechBeheer',
        theme_color: '#0f1419',
        background_color: '#0f1419',
        display: 'standalone',
      },
    }),
  ],
})
