import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/cobalt-proxy': {
        target: 'https://api.cobalt.tools',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/cobalt-proxy/, ''),
        headers: {
          'Accept': 'application/json',
        },
      },
    },
  },
})
