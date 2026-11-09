import { copyFile, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all(['index.html', 'style.css', 'robots.txt', 'sitemap.xml', 'robot.html']
  .map(file => copyFile(file, 'dist/' + file)));
