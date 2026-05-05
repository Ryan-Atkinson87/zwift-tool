import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on all network interfaces so the dev server is reachable from mobile on the LAN.
    host: true,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/workouts': 'http://localhost:8080',
      '/blocks': 'http://localhost:8080',
      '/zone-presets': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
})
