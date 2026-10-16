import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../backend/secrets/key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../backend/secrets/cert.pem')),
    },
    allowedHosts: ['michael.pro.et', 'goatbingo.pro.et']
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://michael.pro.et:3000'),
  },
})
