import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, Vite forwards /api to the local FastAPI server (same path the Ingress uses in Kubernetes).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
})
