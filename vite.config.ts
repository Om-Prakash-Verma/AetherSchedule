import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "AIzaSyBUY6loo9nBGSOWlf3kl2kdwJaba0nq87Q"),
      // Fallback for other potential uses, but API_KEY is the critical one
      'process.env': {} 
    },
    build: {
      outDir: 'dist',
    }
  };
});