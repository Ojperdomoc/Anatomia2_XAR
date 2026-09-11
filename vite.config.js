import { defineConfig } from 'vite';

/**
 * GitHub Pages sirve el sitio en https://<usuario>.github.io/<repo>/
 * (no en la raíz del dominio), así que los assets deben construirse con
 * ese prefijo. En local / en el preview de Arena seguimos usando "/".
 */
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isPagesBuild = process.env.GITHUB_ACTIONS === 'true' || process.env.PAGES === '1';
const base = isPagesBuild && repoName ? `/${repoName}/` : '/';

export default defineConfig({
  base,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
});
