import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await Promise.all(['index.html', 'style.css', 'demo.js', 'robots.txt', 'sitemap.xml']
  .map(file => copyFile(file, 'dist/' + file)));
