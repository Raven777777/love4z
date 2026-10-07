# Love4z

> **PLZ HUG ME HARD**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个静态的交互式个人网页，无需构建步骤或第三方依赖。

### 技术栈

- HTML5
- CSS3
- JavaScript
- WebGPU（支持时用于数字雨效果，不支持时降级为 CSS 动画）
- WOFF2

### 项目结构

```
love4z/
├── index.html           # 主页面
├── src/
│   ├── main.css         # 样式表
│   ├── main.js          # 主脚本
│   ├── font/
│   │   └── FOTMatisProB.woff2
│   └── img/
│       ├── asaka.webp
│       ├── hmzz.webp
│       ├── wuyanss.webp
│       └── wyyyy.webp
├── minify_web.py        # 可选的 HTML/CSS/JS 压缩脚本（Python 标准库）
├── .gitignore
├── LICENSE
└── README.md
```

### 运行

将项目目录部署到任意静态文件服务器即可。也可以在项目目录运行：

```sh
python -m http.server 8000
```

然后访问 <http://localhost:8000>。

### 翻页交互设计

- 页面通过 `#pages` 的 `transform` 配合 CSS transition 翻页。
- 滚轮事件不做节流或防抖：滚动事件按 `deltaY` 方向逐次翻页，连续输入可以连续翻页；这是为了保持翻页响应直接、流畅。
- 方向键、PageUp、PageDown 和空格键由页面接管，用于上下翻页；Tab 保留浏览器原生焦点导航行为。
- 启用 JS 翻页时，翻页舞台固定在视口中，避免浏览器为了聚焦远处链接而滚动整个文档，干扰当前页面位置。

## 📜 许可

本项目基于 [MIT 许可证](LICENSE) 开源。

---

*Empty world just fuck we all.*
