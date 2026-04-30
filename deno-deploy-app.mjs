const DEFAULTS = {
  upstreamBaseUrl: 'https://mx.free.codesonline.dev',
  model: 'gpt-image-2',
  generationEndpoint: '/v1/images/generations',
  editEndpoint: '/v1/images/edits',
  modelsEndpoint: '/v1/models',
  responseFormat: 'b64_json',
  quality: 'high',
  background: 'auto',
  proxyBasePath: '/api/openai',
}

const DIST_DIR = new URL('./dist/', import.meta.url)

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.manifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
}

function env(name, fallback = '') {
  return Deno.env.get(name) || fallback
}

function getConfig() {
  return {
    upstreamBaseUrl: env('UPSTREAM_BASE_URL', DEFAULTS.upstreamBaseUrl),
    upstreamApiKey: env('UPSTREAM_API_KEY', ''),
    model: env('UPSTREAM_MODEL', DEFAULTS.model),
    generationEndpoint: env('UPSTREAM_GENERATION_ENDPOINT', DEFAULTS.generationEndpoint),
    editEndpoint: env('UPSTREAM_EDIT_ENDPOINT', DEFAULTS.editEndpoint),
    modelsEndpoint: env('UPSTREAM_MODELS_ENDPOINT', DEFAULTS.modelsEndpoint),
    responseFormat: env('UPSTREAM_RESPONSE_FORMAT', DEFAULTS.responseFormat),
    quality: env('UPSTREAM_QUALITY', DEFAULTS.quality),
    background: env('UPSTREAM_BACKGROUND', DEFAULTS.background),
    proxyBasePath: env('PROXY_BASE_PATH', DEFAULTS.proxyBasePath),
  }
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function applyCorsHeaders(headers, request) {
  const origin = request.headers.get('Origin') || '*'
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Vary', 'Origin')
}

function json(payload, status = 200, request = null) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  if (request) {
    applyCorsHeaders(headers, request)
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers,
  })
}

function hasFileExtension(pathname) {
  return /\.[a-z0-9]{2,8}$/i.test(pathname)
}

async function tryReadFile(fileUrl) {
  try {
    const file = await Deno.readFile(fileUrl)
    return file
  } catch {
    return null
  }
}

async function serveStatic(requestUrl) {
  const pathname = decodeURIComponent(requestUrl.pathname)
  const cleanedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const directFileUrl = new URL(cleanedPath, DIST_DIR)
  let fileBytes = await tryReadFile(directFileUrl)
  let finalUrl = directFileUrl

  if (!fileBytes && !hasFileExtension(pathname)) {
    finalUrl = new URL('index.html', DIST_DIR)
    fileBytes = await tryReadFile(finalUrl)
  }

  if (!fileBytes) {
    return json({ error: { message: 'Not found' } }, 404)
  }

  const extension = pathname === '/' && !hasFileExtension(pathname)
    ? '.html'
    : finalUrl.pathname.slice(finalUrl.pathname.lastIndexOf('.')).toLowerCase()

  return new Response(fileBytes, {
    status: 200,
    headers: {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    },
  })
}

function publicRuntimeConfig(config) {
  return {
    mode: 'same-origin-proxy',
    lockedSettings: true,
    proxyBasePath: config.proxyBasePath,
    model: config.model,
    generationEndpoint: config.generationEndpoint,
    editEndpoint: config.editEndpoint,
    modelsEndpoint: config.modelsEndpoint,
    responseFormat: config.responseFormat,
    quality: config.quality,
    background: config.background,
  }
}

function rewriteImageUrls(item, request, config) {
  if (!item || typeof item !== 'object' || !item.url) {
    return item
  }

  const rewritten = new URL(`${config.proxyBasePath}/remote-image`, request.url)
  rewritten.searchParams.set('url', item.url)

  return {
    ...item,
    url: rewritten.toString(),
    original_url: item.url,
  }
}

async function proxyRemoteImage(requestUrl, request) {
  const targetUrl = requestUrl.searchParams.get('url')
  if (!targetUrl) {
    return json({ error: { message: '缺少远程图片地址。' } }, 400, request)
  }

  try {
    const upstreamResponse = await fetch(targetUrl)
    const headers = new Headers(upstreamResponse.headers)
    headers.set('Cache-Control', 'no-store')
    applyCorsHeaders(headers, request)
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers,
    })
  } catch (error) {
    return json({ error: { message: `远程图片读取失败：${error.message || String(error)}` } }, 502, request)
  }
}

async function proxyUpstream(request, requestUrl, config) {
  if (!config.upstreamApiKey) {
    return json({ error: { message: '服务端尚未配置 UPSTREAM_API_KEY。' } }, 500, request)
  }

  const upstreamBaseUrl = trimTrailingSlash(config.upstreamBaseUrl)
  const upstreamPath = requestUrl.pathname.slice(config.proxyBasePath.length) + requestUrl.search
  const upstreamUrl = `${upstreamBaseUrl}${upstreamPath}`

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('Content-Type', contentType)
  }
  headers.set('Authorization', `Bearer ${config.upstreamApiKey}`)

  let upstreamResponse
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    })
  } catch (error) {
    return json({ error: { message: `代理请求上游失败：${error.message || String(error)}` } }, 502, request)
  }

  const contentTypeHeader = upstreamResponse.headers.get('content-type') || ''
  if (contentTypeHeader.includes('application/json')) {
    let payload
    try {
      payload = await upstreamResponse.json()
    } catch {
      return json({ error: { message: '上游返回了无法解析的 JSON。' } }, 502, request)
    }

    if (Array.isArray(payload?.data)) {
      payload.data = payload.data.map((item) => rewriteImageUrls(item, request, config))
    }

    return json(payload, upstreamResponse.status, request)
  }

  const headersOut = new Headers(upstreamResponse.headers)
  headersOut.set('Cache-Control', 'no-store')
  applyCorsHeaders(headersOut, request)
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: headersOut,
  })
}

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url)
  const config = getConfig()

  if (request.method === 'OPTIONS' && (requestUrl.pathname === '/api/app-config' || requestUrl.pathname.startsWith(`${config.proxyBasePath}/`))) {
    const headers = new Headers()
    applyCorsHeaders(headers, request)
    return new Response(null, { status: 204, headers })
  }

  if (requestUrl.pathname === '/api/app-config') {
    return json(publicRuntimeConfig(config), 200, request)
  }

  if (requestUrl.pathname === `${config.proxyBasePath}/remote-image`) {
    return proxyRemoteImage(requestUrl, request)
  }

  if (requestUrl.pathname.startsWith(`${config.proxyBasePath}/`)) {
    return proxyUpstream(request, requestUrl, config)
  }

  return serveStatic(requestUrl)
})
