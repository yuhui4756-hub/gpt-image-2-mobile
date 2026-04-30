# GPT-image-2.0 Deno Deploy 免费替代版

这份方案是为了解决你现在的核心问题：

- `workers.dev` 在你当前网络下不通
- 不想让电脑常开
- 尽量不花钱

我已经把当前项目补成了一个可直接部署到 `Deno Deploy` 的版本。

## 为什么选 Deno Deploy

按当前这台电脑的实际网络测试：

- `deno.com` 可访问
- `deno.dev` 可访问
- `workers.dev` 当前超时

所以这条线比 Cloudflare 默认域名更适合你当前网络。

## 代码入口

部署入口文件：

[deno-deploy-app.mjs](D:/AI_Image_Launcher_v1.1/GPT-image-2.0/deno-deploy-app.mjs)

它会同时做两件事：

1. 托管 `dist` 里的前端页面
2. 代理这些接口
   - `/api/app-config`
   - `/api/openai/v1/models`
   - `/api/openai/v1/images/generations`
   - `/api/openai/v1/images/edits`
   - `/api/openai/remote-image`

所以前端不需要再改调用方式。

## 第一次准备

先安装 Deno。

Windows 上最方便的是：

```powershell
winget install DenoLand.Deno
```

装完重新开一个终端。

进入项目目录：

```powershell
cd D:\AI_Image_Launcher_v1.1\GPT-image-2.0
```

先构建前端：

```powershell
npm run build
```

## 本地检查

本地启动 Deno 版：

```powershell
deno task start:deno
```

默认会打印一个本地地址，打开后应该能看到同样的页面。

## 部署到 Deno Deploy

先登录：

```powershell
deno deploy login
```

然后创建应用并部署：

```powershell
deno deploy --project=gpt-image-2-mobile-deno --prod deno-deploy-app.mjs
```

如果终端提示项目不存在，就先到 Deno Deploy 控制台新建一个项目，再执行上面这条。

## 配置上游 key

部署后，到 Deno Deploy 控制台给项目添加环境变量：

- `UPSTREAM_API_KEY` = 你的生图 key

如果你还想显式写这些，也可以一起加：

- `UPSTREAM_BASE_URL` = `https://mx.free.codesonline.dev`
- `UPSTREAM_MODEL` = `gpt-image-2`
- `UPSTREAM_GENERATION_ENDPOINT` = `/v1/images/generations`
- `UPSTREAM_EDIT_ENDPOINT` = `/v1/images/edits`
- `UPSTREAM_MODELS_ENDPOINT` = `/v1/models`
- `UPSTREAM_RESPONSE_FORMAT` = `b64_json`
- `UPSTREAM_QUALITY` = `high`
- `UPSTREAM_BACKGROUND` = `auto`
- `PROXY_BASE_PATH` = `/api/openai`

不过除了 `UPSTREAM_API_KEY`，其他都有默认值，不填也能跑。

## 改完环境变量后

重新部署一次：

```powershell
deno deploy --project=gpt-image-2-mobile-deno --prod deno-deploy-app.mjs
```

## 免费说明

这套方案的目标就是尽量免费起步。

是否完全 0 成本，取决于你后续实际使用量有没有超过 Deno Deploy 免费额度。你可以先用免费额度跑起来，再看是否有必要升级。

## 现在最适合你的顺序

1. 先装 Deno
2. 本地跑一次 `deno task start:deno`
3. 再登录和部署
4. 打开 Deno 给你的线上地址测试
