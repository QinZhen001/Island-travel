# Island-travel

外伶仃岛三天两夜行程页，纯静态站点，自动部署到 GitHub Pages。

## 开发

```bash
npm install
npm run dev      # http://localhost:5173/Island-travel/
npm run build    # 产物在 dist/
npm run preview  # 本地预览构建产物
```

## 目录

```
index.html          页面结构（行程内容都在这里，直接改即可）
src/main.js         交互：滚动动画 / 导航高亮 / Tab / 图片查看 / 清单本地记忆
src/styles/main.css 样式
docs/plan.md        原始行程文档
docs/assets/        图片（构建时原样拷到 dist/assets，无需复制）
```

## 部署

推送到 `main` 分支后，`.github/workflows/deploy.yml` 自动构建并发布到 GitHub Pages。

首次使用需在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

若改用自定义域名或用户主页（根路径），构建时指定：

```bash
BASE_PATH=/ npm run build
```
