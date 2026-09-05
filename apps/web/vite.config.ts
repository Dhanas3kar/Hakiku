import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})

export default config
