import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://192.168.11.114:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        demoApp: resolve(__dirname, 'demo_app.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'admin' ? 'assets/admin/[name]-[hash].js' : 'assets/[name]-[hash].js',
        chunkFileNames: (chunkInfo) => {
          const isAdminOnly = (chunkInfo.moduleIds || []).every(
            (id) => id.includes('AdminPasscode') || id.includes('supabaseAdminClient') || id.includes('main-admin')
          );
          return isAdminOnly ? 'assets/admin/[name]-[hash].js' : 'assets/[name]-[hash].js';
        },
        assetFileNames: (assetInfo) =>
          assetInfo.name && assetInfo.name.includes('admin') ? 'assets/admin/[name]-[hash][extname]' : 'assets/[name]-[hash][extname]',
      },
    },
  },
})
