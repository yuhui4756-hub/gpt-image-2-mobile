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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS' && isApiPath(url.pathname, env)) {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      })
    }

    if (url.pathname === '/api/app-config') {
      return json(
        {
          mode: 'same-origin-proxy',
          lockedSettings: true,
          proxyBasePath: getProxyBasePath(env),
          model: env.UPSTREAM_MODEL || DEFAULTS.model,
          generationEndpoint: env.UPSTREAM_GENERATION_ENDPOINT || DEFAULTS.generationEndpoint,
          editEndpoint: env.UPSTREAM_EDIT_ENDPOINT || DEFAULTS.editEndpoint,
          modelsEndpoint: env.UPSTREAM_MODELS_ENDPOINT || DEFAULTS.modelsEndpoint,
          responseFormat: env.UPSTREAM_RESPONSE_FORMAT || DEFAULTS.responseFormat,
          quality: env.UPSTREAM_QUALITY || DEFAULTS.quality,
          background: env.UPSTREAM_BACKGROUND || DEFAULTS.background,
        },
        200,
        request,
      )
    }

    if (url.pathname === `${getProxyBasePath(env)}/remote-image`) {
      return proxyRemoteImage(request, env, url)
    }

    if (url.pathname.startsWith(`${getProxyBasePath(env)}/`)) {
      return proxyUpstream(request, env, url)
    }

    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request)
      if (assetResponse.status !== 404) {
        return assetResponse
      }

      if (!hasFileExtension(url.pathname)) {
        return env.ASSETS.fetch(new Request(new URL('/index.html', url), request))
      }
    }

    return json({ error: { message: 'Not found' } }, 404, request)
  },
}

function isApiPath(pathname, env) {
  return pathname === '/api/app-config' || pathname.startsWith(`${getProxyBasePath(env)}/`)
}

function getProxyBasePath(env) {
  return (env.PROXY_BASE_PATH || DEFAULTS.proxyBasePath).replace(/\/+$/, '')
}

function hasFileExtension(pathname) {
  return /\.[a-z0-9]{2,8}$/i.test(pathname)
}

async function readRequestBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined
  }

  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json') || contentType.startsWith('text/')) {
    return await request.text()
  }

  return new Uint8Array(await request.arrayBuffer())
}

async function proxyUpstream(request, env, requestUrl) {
  const upstreamBaseUrl = (env.UPSTREAM_BASE_URL || DEFAULTS.upstreamBaseUrl).replace(/\/+$/, '')
  const upstreamPath = requestUrl.pathname.slice(getProxyBasePath(env).length) + requestUrl.search
  const upstreamUrl = `${upstreamBaseUrl}${upstreamPath}`

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('Content-Type', contentType)
  }
  headers.set('Accept', 'application/json, */*')

  const clientAuth = request.headers.get('Authorization')
  if (env.ALLOW_CLIENT_AUTH === 'true' && clientAuth) {
    headers.set('Authorization', clientAuth)
  } else if (env.UPSTREAM_API_KEY) {
    headers.set('Authorization', `Bearer ${env.UPSTREAM_API_KEY}`)
  }

  let requestBody
  try {
    requestBody = await readRequestBody(request)
  } catch (error) {
    return json(
      { error: { message: `Failed to read request body: ${error.message || String(error)}` } },
      400,
      request,
    )
  }

  const init = {
    method: request.method,
    headers,
    body: requestBody,
  }

  let response
  try {
    response = await fetch(upstreamUrl, init)
  } catch (error) {
    return json(
      { error: { message: `Worker 请求上游失败：${error.message || String(error)}` } },
      502,
      request,
    )
  }

  const contentTypeHeader = response.headers.get('content-type') || ''
  if (contentTypeHeader.includes('application/json')) {
    let payload
    try {
      payload = await response.json()
    } catch {
      return json({ error: { message: '上游返回了无法解析的 JSON。' } }, 502, request)
    }

    if (Array.isArray(payload?.data)) {
      payload.data = payload.data.map((item) => rewriteImageUrls(item, request, env))
    }

    return json(payload, response.status, request)
  }

  const proxyHeaders = new Headers(response.headers)
  applyCorsHeaders(proxyHeaders, request)
  proxyHeaders.set('Cache-Control', 'no-store')

  return new Response(response.body, {
    status: response.status,
    headers: proxyHeaders,
  })
}

function rewriteImageUrls(item, request, env) {
  if (!item || typeof item !== 'object' || !item.url) {
    return item
  }

  const remoteImageUrl = new URL(`${getProxyBasePath(env)}/remote-image`, request.url)
  remoteImageUrl.searchParams.set('url', item.url)

  return {
    ...item,
    url: remoteImageUrl.toString(),
    original_url: item.url,
  }
}

async function proxyRemoteImage(request, env, requestUrl) {
  const targetUrl = requestUrl.searchParams.get('url')
  if (!targetUrl) {
    return json({ error: { message: '缺少远程图片地址。' } }, 400, request)
  }

  let response
  try {
    response = await fetch(targetUrl)
  } catch (error) {
    return json({ error: { message: `远程图片读取失败：${error.message || String(error)}` } }, 502, request)
  }

  const headers = new Headers(response.headers)
  applyCorsHeaders(headers, request)
  headers.set('Cache-Control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    headers,
  })
}

function applyCorsHeaders(headers, request) {
  const origin = request.headers.get('Origin') || '*'
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Vary', 'Origin')
}

function corsHeaders(request) {
  const headers = new Headers()
  applyCorsHeaders(headers, request)
  return headers
}

function json(payload, status = 200, request) {
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
