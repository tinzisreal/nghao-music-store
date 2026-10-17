import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Xoá sạch mọi console.log và debugger khi build production, không để lộ bất kỳ dấu vết nội bộ nào
    drop: ['console', 'debugger'],
    legalComments: 'none'
  },
  build: {
    // Tuyệt đối không sinh Source Maps (chống dịch ngược lại mã nguồn TypeScript gốc)
    sourcemap: false,
    minify: 'esbuild'
  }
})
