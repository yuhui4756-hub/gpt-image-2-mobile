# GPT-image-2.0

这是给手机重做的生图 PWA。

## 运行

```powershell
npm install
npm run dev
```

构建静态包：

```powershell
npm run build
```

## 本地代理版

现在项目已经带了一套本地同源代理。

直接启动：

```powershell
npm run local
```

或者在 Windows 里双击：

```text
start-local-app.cmd
```

它会做三件事：

1. 构建前端静态页面。
2. 在这台电脑上启动本地网页服务。
3. 用当前 `D:\AI_Image_Launcher_v1.1\AI_Image_Launcher_v1.1\config.txt` 里的生图接口做同源代理。

这样手机访问这台电脑的局域网地址时，请求会先打到电脑本地代理，再由电脑去请求上游接口，不再让手机浏览器直接跨域访问中转站。

## iPhone 使用

1. 先在电脑上运行 `npm run local` 或双击 `start-local-app.cmd`。
2. 记下终端里显示的局域网地址，例如 `http://192.168.x.x:17021`。
3. 让 iPhone 和电脑连接同一个 Wi‑Fi。
4. 用 Safari 打开这个地址。
5. 如果页面正常打开，就可以直接在手机上出图。

如果后续你还想要“添加到主屏幕 + 更像完整 App”的体验，最好再给这个地址套一层 HTTPS。

## 重要提醒

当前这版已经优先使用本地同源代理。

项目里也仍然保留了一个可选的云端代理模板：

- [proxy/cloudflare-worker.js](D:/AI_Image_Launcher_v1.1/GPT-image-2.0/proxy/cloudflare-worker.js)

如果你之后想让我继续，我可以再把这套本地代理升级成 HTTPS 方案，或者改成可外网访问的轻量部署版。
