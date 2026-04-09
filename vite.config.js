import { defineConfig } from 'vite';

export default defineConfig({
  // index.html в корне — Vite найдёт его автоматически.
  // Дополнительная конфигурация для vanilla JS не нужна.

  server: {
    host: '127.0.0.1',  // явно IPv4, иначе Windows запускает на IPv6
    port: 3000,
    open: true,
  },

  build: {
    outDir:   'dist',
    emptyOutDir: true,
  },
});
