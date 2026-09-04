import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/kunyun-api': {
        target: 'http://43.180.203.3:9090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kunyun-api/u, '/kunyun'),
      },
    },
  },
});
