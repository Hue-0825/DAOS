import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await Promise.all(['index.html', 'style.css', 'demo.js', 'robots.txt', 'sitemap.xml', 'robot.html', 'robot.css', 'robot-sim.mjs', 'robot-view.mjs', 'warehouse-scene.mjs']
  .map(file => copyFile(file, 'dist/' + file)));
