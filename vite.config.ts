import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // Fixes "Module not found: Error: Can't resolve 'crypto'"
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'util', 'process', 'vm', 'http', 'https', 'os', 'url'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      process: 'process/browser',
      stream: 'stream-browserify',
      zlib: 'browserify-zlib',
      util: 'util',
    },
  },
  define: {
    'process.env': process.env,
    'global': 'window',
  },
});
