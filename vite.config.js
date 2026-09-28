import { defineConfig } from 'vite'
import { rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
// 仓库名，用于 GitHub Pages 的子路径；自定义域名部署时可传 BASE_PATH=/
const base = process.env.BASE_PATH || '/Island-travel/'

export default defineConfig({
  base,
  // docs/assets 下的图片直接作为静态资源，构建时原样拷到 dist/assets
  publicDir: 'docs',
  build: {
    outDir: 'dist',
    assetsDir: 'static',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'tidy-public-output',
      closeBundle() {
        // 不要发布原始 md；同时关掉 Jekyll，避免下划线目录被忽略
        rmSync(resolve(root, 'dist/plan.md'), { force: true })
        writeFileSync(resolve(root, 'dist/.nojekyll'), '')
      },
    },
  ],
})
