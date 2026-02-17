import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Carga las variables de entorno desde la raíz
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
      server: {
        port: 3000,
        host: true, // Esto es igual a '0.0.0.0', abre el puerto a la red (Windows)
        watch: {
            usePolling: true, // <--- ESTO ES LA CLAVE PARA WSL. Obliga a vigilar los archivos.
        },
      },
      plugins: [react()],
      define: {
        // Exponemos las variables para que el código las lea
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Ajuste estándar: usualmente @ apunta a /src, pero si tu estructura es distinta, mantén '.'
          '@': path.resolve(__dirname, './src'), 
        }
      }
    };
});