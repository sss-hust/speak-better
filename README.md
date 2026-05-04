# speak-better

会说 AI 比赛项目。当前版本是一个单页前端 + Node 本地代理服务的可部署形态，页面展示和交互逻辑保持原型风格不变，但代码已经拆分成可维护的工程结构。

`archive/huishuo-ai-prototype.single-file.html` 保留了拆分前的单文件原型，方便回溯和对照。

## 项目结构

```text
.
├─ archive/
│  └─ huishuo-ai-prototype.single-file.html
├─ public/
│  ├─ index.html
│  ├─ scripts/app.js
│  └─ styles/app.css
├─ src/
│  ├─ config.js
│  ├─ deepseek.js
│  ├─ env.js
│  ├─ reply-seeds.js
│  └─ server.js
├─ .env.example
├─ Dockerfile
├─ package.json
├─ render.yaml
└─ server.js
```

## 本地运行

1. 安装 Node.js 20 或更高版本。
2. 复制环境变量模板：

```bash
cp .env.example .env
```

3. 在 `.env` 中填写：

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_MODEL=deepseek-v4-pro
PORT=3000
```

4. 启动服务：

```bash
npm start
```

5. 浏览器访问：

```text
http://127.0.0.1:3000
```

## 回复接口

- `GET /api/health`
- `POST /api/reply-suggestions`

请求体示例：

```json
{
  "original": "PPT 我还差一点",
  "tone": ["友好"],
  "need": "帮我礼貌一点回复，顺便轻轻催一下今晚能不能发初版",
  "conversation": [
    { "role": "other", "text": "我负责案例和竞品分析，数据那块谁来补？" },
    { "role": "me", "text": "好的，那我好好做 PPT，请大家尽量在这周五之前把各自的部分发我哦~" }
  ]
}
```

## 部署建议

### 方案一：Render

适合比赛交付一个公网链接，接 GitHub 仓库后可自动部署。仓库里已经提供 `render.yaml`。

需要配置的环境变量：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL=deepseek-v4-pro`

部署步骤：

1. 把代码推到 GitHub。
2. 在 Render 新建 Web Service 或直接使用 Blueprint。
3. 连接仓库并确认 `startCommand` 为 `node server.js`。
4. 填写环境变量并部署。

### 方案二：Railway

适合快速拿到公网域名。连接 GitHub 仓库后可直接部署，默认可识别 `npm start`。

需要配置的环境变量：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL=deepseek-v4-pro`

### 方案三：云服务器

适合你后面要长期保留比赛链接或避免免费平台休眠。

推荐做法：

1. 购买一台最小规格 Linux 云主机。
2. 安装 Node.js 20。
3. `git clone` 仓库。
4. 配置 `.env`。
5. 用 `pm2` 或 `systemd` 常驻运行 `node server.js`。
6. 用 Nginx 反向代理到 `3000` 端口。
7. 配置域名和 HTTPS。

## 版本管理建议

- `main`：可部署、可演示版本
- `dev`：日常开发分支
- `feature/*`：功能分支

推荐提交节奏：

1. 功能拆分完成后提交
2. 接口联调完成后提交
3. 部署配置完成后提交
4. 比赛提交前打一个 tag，例如 `v1.0.0`

## 安全提醒

- 不要把真实 API key 提交到 GitHub。
- 只提交 `.env.example`，不要提交 `.env`。
- 如果 key 曾出现在聊天记录、截图、日志或公开仓库里，请立即旋转。
