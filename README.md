# 常青藤快讯 (EverRead)

AI 驱动的新闻资讯站，自动搜索整理最新新闻。

## 技术栈

- **前端**: 纯 HTML/CSS/JS
- **后端**: Cloudflare Pages Functions
- **存储**: Cloudflare KV
- **AI**: OpenAI 兼容接口
- **定时更新**: GitHub Actions

## 部署步骤

### 1. 创建 KV Namespace

```bash
npx wrangler kv namespace create NEWS_KV
```

将输出的 ID 填入 `wrangler.toml` 的 `id` 字段。

### 2. 配置环境变量

在 Cloudflare Pages 项目设置中添加：

| 变量名 | 说明 |
|--------|------|
| `AI_BASE_URI` | AI 接口地址，如 `https://api.openai.com/v1` |
| `AI_MODEL` | 模型名称，如 `gpt-4o-mini` |
| `AI_API_KEY` | API Key |
| `UPDATE_SECRET` | 更新接口鉴权密钥（自定义强密码） |

### 3. 部署到 Cloudflare Pages

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 部署
npm run deploy
```

或通过 GitHub 集成自动部署：
1. 在 Cloudflare Dashboard 创建 Pages 项目
2. 连接 GitHub 仓库
3. 设置构建输出目录为 `public`
4. 配置环境变量

### 4. 配置定时更新

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加：

| Secret 名 | 说明 |
|-----------|------|
| `SITE_URL` | 网站地址，如 `https://read.zhigupu.com` |
| `UPDATE_SECRET` | 与 CF Pages 环境变量中的值相同 |

GitHub Actions 会在每天 8:00、12:00、18:00、22:00 (CST) 自动触发更新。

也可以在 Actions 页面手动触发。

## 本地开发

```bash
# 创建 .dev.vars 文件（不提交到 git）
cat > .dev.vars << EOF
AI_BASE_URI=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_API_KEY=your-api-key
UPDATE_SECRET=your-secret
EOF

# 启动本地开发服务器
npm run dev
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/news?category=&page=&limit=&tag=` | 新闻列表 |
| GET | `/api/news/:id` | 新闻详情 |
| GET | `/api/categories` | 分类列表 |
| POST | `/api/update` | 触发更新（需鉴权） |
| POST | `/api/ai/chat` | AI 对话代理 |

## 项目结构

```
├── public/                 # 静态前端
│   ├── index.html         # 首页
│   ├── news.html          # 详情页
│   ├── css/style.css      # 样式
│   └── js/                # 前端逻辑
├── functions/             # Pages Functions（后端）
│   ├── _middleware.js     # CORS 中间件
│   └── api/               # API 端点
├── .github/workflows/     # 定时更新
└── wrangler.toml          # CF 配置
```
