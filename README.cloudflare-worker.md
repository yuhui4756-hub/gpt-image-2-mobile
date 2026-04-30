# GPT-image-2.0 Cloudflare Worker 免费代理版

这套方案的目标是：

1. 不让手机继续依赖你电脑常开。
2. 不让浏览器前端直连会拦 CORS 的中转站。
3. 尽量先用 Cloudflare 免费额度跑起来。

## 它现在是怎么工作的

部署后同一个 Worker 会同时做两件事：

1. 托管 `GPT-image-2.0` 前端页面。
2. 代理这些接口：
   - `/api/app-config`
   - `/api/openai/v1/models`
   - `/api/openai/v1/images/generations`
   - `/api/openai/v1/images/edits`
   - `/api/openai/remote-image`

这样手机访问的是你自己的 `*.workers.dev` 页面，页面再通过同域 `/api/openai/...` 调 Worker，Worker 再去请求你的中转站。

## 当前默认上游

默认已经写成你现在在用的接口：

- `UPSTREAM_BASE_URL = https://mx.free.codesonline.dev`
- `UPSTREAM_MODEL = gpt-image-2`

API key 不写在仓库里，而是走 Cloudflare secret。

## 第一次部署

先在项目根目录打开终端：

```powershell
cd D:\AI_Image_Launcher_v1.1\GPT-image-2.0
```

登录 Cloudflare：

```powershell
npx wrangler login
```

把上游 key 存成 Cloudflare secret：

```powershell
npx wrangler secret put UPSTREAM_API_KEY
```

它会提示你输入 key，把你当前可用的生图 key 粘进去即可。

然后直接部署：

```powershell
npm run cf:deploy
```

成功后会返回一个 `https://你的名字.workers.dev` 地址。

## 部署后怎么用

直接用 Safari 打开 Cloudflare 返回的 `workers.dev` 地址。

这时页面会自动进入“代理托管”模式：

- 前端不再要求填写 API key
- 页面会通过 `/api/app-config` 识别代理环境
- 出图请求会自动走 Worker

## 如果想改 Worker 名称

改这个文件：

[wrangler.jsonc](D:/AI_Image_Launcher_v1.1/GPT-image-2.0/wrangler.jsonc)

把：

```jsonc
"name": "gpt-image-2-mobile"
```

改成你想要的名字再部署。

## 如果以后想换供应商

改 `wrangler.jsonc` 里的这些变量：

- `UPSTREAM_BASE_URL`
- `UPSTREAM_MODEL`
- `UPSTREAM_GENERATION_ENDPOINT`
- `UPSTREAM_EDIT_ENDPOINT`
- `UPSTREAM_MODELS_ENDPOINT`

如果只是换 key，不用改文件，重新执行：

```powershell
npx wrangler secret put UPSTREAM_API_KEY
```

## 本地预览 Worker 版

```powershell
npm run cf:dev
```

它会先构建页面，再跑本地 Worker 预览。

## 费用提醒

这套默认就是朝“尽量不花钱”去做的：

- 用 `workers.dev`
- 不绑自定义域名
- 不单独买服务器

是否完全 0 成本，取决于你后续使用量有没有超过 Cloudflare 免费额度。

但对你当前这种个人生图网页来说，先跑起来通常不需要先花钱。
