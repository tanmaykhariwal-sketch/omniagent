import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/register': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/history': 'http://localhost:3000',
      '/generate-image': 'http://localhost:3000',
      '/transcribe': 'http://localhost:3000',
      '/finance': 'http://localhost:3000',
      '/news': 'http://localhost:3000',
    },
  },
});
