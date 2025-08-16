import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/panda-royale/',   // 👈 IMPORTANT: must match repo name exactly
})
