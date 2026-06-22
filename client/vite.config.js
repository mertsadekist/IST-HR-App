import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, './src/api'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@store': path.resolve(__dirname, './src/store'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@configs': path.resolve(__dirname, './src/configs'),
      '@layout': path.resolve(__dirname, './src/layout'),
    }
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split heavy third-party libraries into their own long-term-cacheable
        // chunks so the app/Dashboard entry stays under the size warning.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // Leave the lazy pdf libs UNASSIGNED: they are dynamically imported in
          // utils/pdf.js, so rolldown keeps them in on-demand chunks that load
          // only when a document is generated — never inflating the entry.
          if (/[\\/]node_modules[\\/](html2canvas|jspdf|pdf-lib|canvg|fflate|@pdf-lib)/.test(id)) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/]node_modules[\\/](@reduxjs|react-redux|redux|immer|reselect)[\\/]/.test(id)) return 'redux-vendor';
          if (/[\\/]node_modules[\\/](recharts|d3-|victory|internmap|decimal\.js)/.test(id)) return 'charts-vendor';
          if (/[\\/]node_modules[\\/](i18next|react-i18next)/.test(id)) return 'i18n-vendor';
          if (/[\\/]node_modules[\\/](lucide-react)/.test(id)) return 'icons-vendor';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Proxy →', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Proxy ←', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    css: true,
  },
})
