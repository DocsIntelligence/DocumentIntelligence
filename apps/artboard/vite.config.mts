import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/artboard',
  server: {
    port: 4210,
    host: true,
    // Vite 5+ guards against DNS-rebinding by rejecting Host headers it
    // doesn't recognise. The PDF render worker reaches us via Docker's
    // host-gateway alias, so allow it explicitly. Adjust this list if
    // you front the artboard with a different hostname in dev.
    allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal'],
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
  preview: {
    port: 4210,
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal'],
  },
  plugins: [react(), nxViteTsPaths()],
  build: {
    outDir: '../../dist/apps/artboard',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
}));
