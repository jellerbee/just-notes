import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        format: 'iife', // Use IIFE instead of ES modules for better Electron compatibility
        entryFileNames: 'assets/[name].js',
      }
    }
  },
  server: {
    port: 5173,
  },
})