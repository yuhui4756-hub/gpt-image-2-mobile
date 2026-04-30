import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.join(PROJECT_ROOT, 'dist')
const FALLBACK_CONFIG_PATH = path.resolve(PROJECT_ROOT, '..', 'AI_Image_Launcher_v1.1', 'config.txt')

const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number(process.env.PORT || 17021)

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

const providerConfig = loadProviderConfig()

function loadProviderConfig() {
  const defaults = {
    baseUrl: 'https://mx.free.codesonline.dev',
    apiKey: '',
    model: 'gpt-image-2',
    generationEndpoint: '/v1/images/generations',
    editEndpoint: '/v1/images/edits',
    modelsEndpoint: '/v1/models',
    responseFormat: 'b64_json',
    quality: 'high',
    background: 'auto',
    timeout: 180,
  }

  if (!existsSync(FALLBACK_CONFIG_PATH)) {
    return defaults
  }

  const raw = readTextFile(FALLBACK_CONFIG_PATH)
  const parsed = parseIniLikeConfig(raw)

  return {
    ...defaults,
    baseUrl: parsed.api?.base_url || defaults.baseUrl,
    apiKey: parsed.api?.api_key || defaults.apiKey,
    model: parsed.api?.model || defaults.model,
    generationEndpoint: parsed.api?.generation_endpoint || defaults.generationEndpoint,
    editEndpoint: parsed.api?.edit_endpoint || defaults.editEndpoint,
    modelsEndpoint: parsed.api?.models_endpoint || defaults.modelsEndpoint,
    responseFormat: parsed.api?.response_format || defaults.responseFormat,
    quality: parsed.image?.quality || defaults.quality,
    background: parsed.image?.background || defaults.background,
    timeout: Number(parsed.api?.timeout || defaults.timeout),
  }
}

function readTextFile(filePath) {
  return Buffer.from(readFileSync(filePath)).toString('utf8')
}

function parseIniLikeConfig(text) {
  const sections = {}
  let currentSection = 'root'
  sections[currentSection] = {}

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) {
      continue
    }
    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      sections[currentSection] ||= {}
      continue
    }
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    sections[currentSection][key] = value
  }

  return sections
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function text(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
  })
  response.end(payload)
}

function collectRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function getProxyBasePath() {
  return '/api/openai'
}

function getPublicRuntimeConfig() {
  return {
    mode: 'same-origin-proxy',
    lockedSettings: true,
    accessUrls: getAccessUrls(),
    proxyBasePath: getProxyBasePath(),
    model: providerConfig.model,
    generationEndpoint: providerConfig.generationEndpoint,
    editEndpoint: providerConfig.editEndpoint,
    modelsEndpoint: providerConfig.modelsEndpoint,
    responseFormat: providerConfig.responseFormat,
    quality: providerConfig.quality,
    background: providerConfig.background,
  }
}

function getAccessUrls() {
  const urls = [`http://127.0.0.1:${PORT}`]
  for (const net of Object.values(os.networkInterfaces())) {
    for (const item of net || []) {
      if (item.family === 'IPv4' && !item.internal) {
        urls.push(`http://${item.address}:${PORT}`)
      }
    }
  }
  return [...new Set(urls)]
}

async function proxyOpenAiRequest(request, response, upstreamPath) {
  if (!providerConfig.apiKey) {
    json(response, 500, { error: { message: '本地代理没有读取到可用的 API key。' } })
    return
  }

  const method = request.method || 'GET'
  const requestBody = method === 'GET' || method === 'HEAD' ? undefined : await collectRequestBody(request)
  const headers = {
    Authorization: `Bearer ${providerConfig.apiKey}`,
  }

  if (request.headers['content-type']) {
    headers['Content-Type'] = request.headers['content-type']
  }

  const upstreamUrl = new URL(upstreamPath, `${trimTrailingSlash(providerConfig.baseUrl)}/`)

  let upstreamResponse
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(Math.max(30, providerConfig.timeout) * 1000),
    })
  } catch (error) {
    json(response, 502, {
      error: {
        message: `本地代理请求上游失败：${error.message || String(error)}`,
      },
    })
    return
  }

  const contentType = upstreamResponse.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const payload = await upstreamResponse.json().catch(() => null)
    if (!payload) {
      json(response, 502, { error: { message: '上游返回了无法解析的 JSON。' } })
      return
    }

    if (Array.isArray(payload.data)) {
      payload.data = payload.data.map((item) => rewriteRemoteImageUrls(item))
    }

    json(response, upstreamResponse.status, payload)
    return
  }

  const raw = Buffer.from(await upstreamResponse.arrayBuffer())
  response.writeHead(upstreamResponse.status, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType || 'application/octet-stream',
  })
  response.end(raw)
}

function rewriteRemoteImageUrls(item) {
  if (!item || typeof item !== 'object' || !item.url) {
    return item
  }
  const proxyUrl = `${getProxyBasePath()}/remote-image?url=${encodeURIComponent(item.url)}`
  return {
    ...item,
    url: proxyUrl,
    original_url: item.url,
  }
}

async function proxyRemoteImage(requestUrl, response) {
  const rawUrl = requestUrl.searchParams.get('url')
  if (!rawUrl) {
    json(response, 400, { error: { message: '缺少远程图片地址。' } })
    return
  }

  let upstreamResponse
  try {
    upstreamResponse = await fetch(rawUrl, {
      signal: AbortSignal.timeout(Math.max(30, providerConfig.timeout) * 1000),
    })
  } catch (error) {
    json(response, 502, { error: { message: `读取远程图片失败：${error.message || String(error)}` } })
    return
  }

  const raw = Buffer.from(await upstreamResponse.arrayBuffer())
  response.writeHead(upstreamResponse.status, {
    'Cache-Control': 'no-store',
    'Content-Type': upstreamResponse.headers.get('content-type') || 'image/png',
  })
  response.end(raw)
}

async function serveStatic(requestUrl, response) {
  const pathname = decodeURIComponent(requestUrl.pathname)
  const targetPath = pathname === '/'
    ? path.join(DIST_DIR, 'index.html')
    : path.join(DIST_DIR, pathname.replace(/^\/+/, ''))

  let resolvedPath = targetPath
  try {
    const targetStat = await stat(targetPath)
    if (targetStat.isDirectory()) {
      resolvedPath = path.join(targetPath, 'index.html')
    }
  } catch {
    resolvedPath = path.join(DIST_DIR, 'index.html')
  }

  if (!resolvedPath.startsWith(DIST_DIR) || !existsSync(resolvedPath)) {
    text(response, 404, 'Not found')
    return
  }

  const extension = path.extname(resolvedPath).toLowerCase()
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
  })
  createReadStream(resolvedPath).pipe(response)
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || `127.0.0.1:${PORT}`}`)

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    })
    response.end()
    return
  }

  if (requestUrl.pathname === '/api/app-config') {
    json(response, 200, getPublicRuntimeConfig())
    return
  }

  if (requestUrl.pathname === `${getProxyBasePath()}/remote-image`) {
    await proxyRemoteImage(requestUrl, response)
    return
  }

  if (requestUrl.pathname === `${getProxyBasePath()}${providerConfig.modelsEndpoint}`) {
    await proxyOpenAiRequest(request, response, providerConfig.modelsEndpoint)
    return
  }

  if (requestUrl.pathname === `${getProxyBasePath()}${providerConfig.generationEndpoint}`) {
    await proxyOpenAiRequest(request, response, providerConfig.generationEndpoint)
    return
  }

  if (requestUrl.pathname === `${getProxyBasePath()}${providerConfig.editEndpoint}`) {
    await proxyOpenAiRequest(request, response, providerConfig.editEndpoint)
    return
  }

  await serveStatic(requestUrl, response)
})

server.listen(PORT, HOST, () => {
  if (!existsSync(DIST_DIR)) {
    console.warn('dist 目录还不存在，请先运行 npm run build。')
  }
  console.log(`GPT-image-2.0 local app is running on port ${PORT}.`)
  console.log('Open one of these URLs:')
  for (const item of getAccessUrls()) {
    console.log(`  ${item}`)
  }
})
