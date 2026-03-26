import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'

function versionJsonPlugin(): Plugin {
  return {
    name: 'version-json',
    apply: 'build',
    closeBundle() {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
      const payload = { version: pkg.version, buildTime: new Date().toISOString() }
      const outDir = path.resolve(__dirname, 'dist')
      fs.mkdirSync(outDir, { recursive: true })
      fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify(payload))
    },
  }
}

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
    versionJsonPlugin(),
  ],
})
