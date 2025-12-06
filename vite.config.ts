import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // API_KEY removed. It is now handled securely in Firebase Cloud Functions.
      'process.env': {} 
    },
    build: {
      outDir: 'dist',
    }
  };
});