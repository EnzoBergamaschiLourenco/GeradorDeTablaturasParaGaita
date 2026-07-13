import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // ... plugins
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  define: {
    global: 'window',
  },
});