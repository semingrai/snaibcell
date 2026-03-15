import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/clinical-brief": "http://localhost:8000",
      "/chat": "http://localhost:8000",
      "/triage": "http://localhost:8000",
      "/demo-patients": "http://localhost:8000",
    },
  },
})
