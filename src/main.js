import './style.css'

const SETTINGS_KEY = 'gpt-image-2-mobile-settings'
const HISTORY_KEY = 'gpt-image-2-mobile-history'
const PREFS_KEY = 'gpt-image-2-mobile-prefs'
const MAX_HISTORY = 8
const DEFAULT_PROVIDER_HOST = 'https://mx.free.codesonline.dev'
const SAME_ORIGIN_PROXY_PATH = '/api/openai'

const DEFAULT_SETTINGS = {
  baseUrl: DEFAULT_PROVIDER_HOST,
  proxyUrl: '',
  apiKey: '',
  model: 'gpt-image-2',
  generationEndpoint: '/v1/images/generations',
  editEndpoint: '/v1/images/edits',
  modelsEndpoint: '/v1/models',
  responseFormat: 'b64_json',
  quality: 'high',
  background: 'auto',
}

const DEFAULT_PREFS = {
  style: 'cinematic',
  sizePreset: 'portrait',
  count: 1,
  continueFromLast: true,
}

const STYLE_PRESETS = [
  { id: 'cinematic', label: '电影感', hint: '像大片海报一样有冲击力' },
  { id: 'product photo', label: '产品海报', hint: '更适合做封面与宣传图' },
  { id: 'realistic', label: '真实摄影', hint: '更贴近真实镜头语言' },
  { id: 'future concept', label: '未来概念', hint: '更锋利、更科幻、更强' },
  { id: 'anime', label: '动漫插画', hint: '角色与风格感更鲜明' },
]

const SIZE_PRESETS = [
  { id: 'portrait', label: '竖版', size: '1024x1536', chip: '3:4' },
  { id: 'square', label: '方形', size: '1024x1024', chip: '1:1' },
  { id: 'landscape', label: '横版', size: '1536x1024', chip: '3:2' },
]

const COUNT_PRESETS = [1, 2, 4]

const state = {
  settings: loadSettings(),
  prefs: loadJson(PREFS_KEY, DEFAULT_PREFS),
  history: loadJson(HISTORY_KEY, []),
  source: null,
  results: [],
  selectedIndex: 0,
  busy: false,
  mode: 'text',
  runtimeProxy: false,
  runtimeConfig: null,
  toastTimer: null,
  activeJobId: '',
}

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="mobile-app">
    <div class="ambient ambient-a"></div>
    <div class="ambient ambient-b"></div>
    <div class="ambient ambient-c"></div>

    <header class="topbar">
      <button class="topbar-btn" type="button" data-open-sheet="historySheet" aria-label="打开历史">历</button>
      <div class="topbar-title">
        <span class="topbar-mark">G2</span>
        <div class="topbar-copy">
          <strong>GPT-image-2.0</strong>
          <small id="connectionLabel">直连模式</small>
        </div>
      </div>
      <button class="topbar-btn" type="button" data-open-sheet="settingsSheet" aria-label="打开设置">设</button>
    </header>

    <main class="stage-shell">
      <section class="visual-stage">
        <div class="stage-topline">
          <div class="stage-status">
            <div class="status-pill">
              <span class="status-dot"></span>
              <strong id="statusHeadline">准备就绪</strong>
            </div>
            <p id="statusText" class="status-line">先写提示词，再决定要不要加参考图。</p>
          </div>
        </div>

        <div class="result-viewer" id="resultViewer">
          <div class="result-placeholder">
            <div class="placeholder-orb">G2</div>
            <p>生成结果会在这里成为主视觉。</p>
          </div>
        </div>

        <div class="thumb-strip" id="thumbStrip"></div>
      </section>
    </main>

    <div class="composer-dock">
      <div class="composer-card">
        <textarea
          id="promptInput"
          class="prompt-input"
          rows="2"
          placeholder="写下你想要的画面，例如：像旗舰级手机广告一样惊艳，液态玻璃、冷蓝高光、极强空间层次。"
        ></textarea>
        <div class="composer-bottom">
          <div class="composer-toolbar">
            <div class="mode-switch-inline" id="modeSwitch">
              <button class="mode-pill is-active" data-mode="text" type="button">文生图</button>
              <button class="mode-pill" data-mode="edit" type="button">图生图</button>
            </div>
            <button class="tool-pill" type="button" data-open-sheet="controlSheet">调节</button>
            <label class="tool-pill upload-pill" for="sourceInput">加图</label>
          </div>
          <button id="generateButton" class="generate-button" type="button" aria-label="开始生成">生成</button>
        </div>
      </div>
    </div>

    <input id="sourceInput" type="file" accept="image/*" hidden />

    <div class="sheet" id="controlSheet" hidden>
      <div class="sheet-backdrop" data-close-sheet="controlSheet"></div>
      <section class="sheet-card compact-sheet">
        <div class="sheet-head">
          <div>
            <span class="sheet-kicker">创作控制</span>
            <strong>出图参数</strong>
          </div>
          <button class="sheet-close" type="button" data-close-sheet="controlSheet">×</button>
        </div>

        <div class="chip-block">
          <div class="chip-block-title">风格</div>
          <div class="chip-row" id="styleChips"></div>
        </div>

        <div class="dual-block">
          <div class="chip-block">
            <div class="chip-block-title">画幅</div>
            <div class="chip-row" id="sizeChips"></div>
          </div>
          <div class="chip-block">
            <div class="chip-block-title">数量</div>
            <div class="chip-row" id="countChips"></div>
          </div>
        </div>

        <div class="source-panel">
          <div class="source-panel-head">
            <strong>参考图</strong>
            <label class="switch-line">
              <input id="continueToggle" type="checkbox" />
              <span>沿用上一张</span>
            </label>
          </div>
          <div class="source-stage">
            <div class="source-empty" id="sourceEmpty">
              <div class="source-empty-mark">IMG</div>
              <div>
                <strong>当前没有参考图</strong>
                <p>上传本地图片，或者把当前结果设为参考图。</p>
              </div>
            </div>
            <img id="sourcePreview" class="source-preview" alt="" hidden />
          </div>
          <div class="source-actions">
            <label class="tool-pill upload-pill" for="sourceInput">上传图片</label>
            <button class="tool-pill" id="clearSource" type="button">移除参考图</button>
          </div>
        </div>

        <div class="install-note">
          <strong>iPhone 使用</strong>
          <p>用 Safari 打开后，点分享，再选“添加到主屏幕”。</p>
        </div>
      </section>
    </div>

    <div class="sheet" id="historySheet" hidden>
      <div class="sheet-backdrop" data-close-sheet="historySheet"></div>
      <section class="sheet-card history-sheet">
        <div class="sheet-head">
          <div>
            <span class="sheet-kicker">历史</span>
            <strong>最近提示词</strong>
          </div>
          <button class="sheet-close" type="button" data-close-sheet="historySheet">×</button>
        </div>
        <div class="history-list" id="historyList"></div>
      </section>
    </div>

    <div class="sheet" id="settingsSheet" hidden>
      <div class="sheet-backdrop" data-close-sheet="settingsSheet"></div>
      <section class="sheet-card settings-sheet">
        <div class="sheet-head">
          <div>
            <span class="sheet-kicker">连接</span>
            <strong>接口设置</strong>
          </div>
          <button class="sheet-close" type="button" data-close-sheet="settingsSheet">×</button>
        </div>

        <div class="settings-grid">
          <label>
            API 地址
            <input id="baseUrlInput" type="text" placeholder="https://example.com" />
          </label>
          <label>
            代理地址
            <input id="proxyUrlInput" type="text" placeholder="可选，用来绕过浏览器跨域" />
          </label>
          <label>
            API Key
            <input id="apiKeyInput" type="password" placeholder="输入你的 key" />
          </label>
          <label>
            模型
            <input id="modelInput" type="text" placeholder="gpt-image-2" />
          </label>
          <label>
            生成端点
            <input id="generationEndpointInput" type="text" />
          </label>
          <label>
            编辑端点
            <input id="editEndpointInput" type="text" />
          </label>
        </div>

        <div class="settings-note">
          <strong>重要提醒</strong>
          <p id="settingsHint">当前已内置你可用的生图接口。如果这个供应商不允许浏览器跨域，请填写代理地址，否则手机网页会卡在请求阶段。</p>
        </div>

        <div class="sheet-actions">
          <button id="testConnection" class="tool-pill" type="button">测试连接</button>
          <button id="saveSettings" class="generate-button mini-generate" type="button">保存</button>
        </div>
      </section>
    </div>

    <div class="toast" id="toast" hidden></div>
  </div>
`

const $ = (selector) => document.querySelector(selector)

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return Array.isArray(fallback) ? [...fallback] : { ...fallback }
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : [...fallback]
    }
    return { ...fallback, ...(parsed || {}) }
  } catch {
    return Array.isArray(fallback) ? [...fallback] : { ...fallback }
  }
}

function loadSettings() {
  const parsed = loadJson(SETTINGS_KEY, DEFAULT_SETTINGS)
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    baseUrl: parsed.baseUrl?.trim() || DEFAULT_SETTINGS.baseUrl,
    proxyUrl: parsed.proxyUrl?.trim() || '',
    apiKey: parsed.apiKey?.trim() || '',
    model: parsed.model?.trim() || DEFAULT_SETTINGS.model,
    generationEndpoint: parsed.generationEndpoint?.trim() || DEFAULT_SETTINGS.generationEndpoint,
    editEndpoint: parsed.editEndpoint?.trim() || DEFAULT_SETTINGS.editEndpoint,
    modelsEndpoint: parsed.modelsEndpoint?.trim() || DEFAULT_SETTINGS.modelsEndpoint,
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function nowLabel() {
  return new Date().toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function isSameOriginProxy(value) {
  return normalizeBaseUrl(value).endsWith(SAME_ORIGIN_PROXY_PATH)
}

function isBuiltInProvider() {
  return normalizeBaseUrl(state.settings.baseUrl) === normalizeBaseUrl(DEFAULT_PROVIDER_HOST)
}

function usesManagedAuth() {
  return state.runtimeProxy || Boolean(state.settings.proxyUrl.trim() && !state.settings.apiKey.trim())
}

function joinUrl(base, path) {
  return `${normalizeBaseUrl(base)}/${String(path || '').replace(/^\/+/, '')}`
}

function openSheet(id, open = true) {
  const node = document.getElementById(id)
  if (node) {
    node.hidden = !open
  }
}

async function loadRuntimeProxyConfig() {
  try {
    const response = await fetch('/api/app-config', {
      cache: 'no-store',
    })
    if (!response.ok) {
      return
    }
    const config = await response.json()
    if (config?.mode !== 'same-origin-proxy') {
      return
    }
    state.runtimeProxy = true
    state.runtimeConfig = config
    state.settings = {
      ...state.settings,
      proxyUrl: SAME_ORIGIN_PROXY_PATH,
      apiKey: '',
      model: config.model || state.settings.model,
      generationEndpoint: config.generationEndpoint || state.settings.generationEndpoint,
      editEndpoint: config.editEndpoint || state.settings.editEndpoint,
      modelsEndpoint: config.modelsEndpoint || state.settings.modelsEndpoint,
      responseFormat: config.responseFormat || state.settings.responseFormat,
      quality: config.quality || state.settings.quality,
      background: config.background || state.settings.background,
    }
  } catch {
    state.runtimeProxy = false
    state.runtimeConfig = null
  }
}

function getSelectedStyle() {
  return STYLE_PRESETS.find((item) => item.id === state.prefs.style) || STYLE_PRESETS[0]
}

function getSelectedSize() {
  return SIZE_PRESETS.find((item) => item.id === state.prefs.sizePreset) || SIZE_PRESETS[0]
}

function selectedResult() {
  return state.results[state.selectedIndex] || null
}

function setStatus(headline, text) {
  $('#statusHeadline').textContent = headline
  $('#statusText').textContent = text
}

function setMode(mode) {
  state.mode = mode
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode)
  })
  if (mode === 'edit') {
    setStatus('图生图模式', '上传参考图后，会尽量保留主体和构图。')
  } else {
    setStatus('文生图模式', '只靠提示词直接开始新一轮生成。')
  }
}

function setBusy(value) {
  state.busy = value
  $('#generateButton').disabled = value
  $('#generateButton').textContent = value ? '生成中...' : '生成'
  document.body.classList.toggle('is-busy', value)
}

function toast(message) {
  const node = $('#toast')
  node.hidden = false
  node.textContent = message
  clearTimeout(state.toastTimer)
  state.toastTimer = setTimeout(() => {
    node.hidden = true
  }, 2400)
}

function updateDock() {
  $('#connectionLabel').textContent = state.runtimeProxy
    ? '本地代理'
    : usesManagedAuth()
      ? '云端代理'
    : state.settings.proxyUrl
      ? '代理模式'
      : isBuiltInProvider()
        ? '已接入接口'
        : '直连模式'
  $('#settingsHint').textContent = state.runtimeProxy
    ? '当前正通过这台电脑的本地代理出图，前端无需填写 API key。手机请和电脑保持同一网络。'
    : usesManagedAuth()
      ? '当前正通过代理地址转发生图请求，前端可以不填写 API key。适合接 Cloudflare Worker。'
    : isBuiltInProvider()
      ? '当前已内置你可用的生图接口。它本身可出图，但手机网页直连通常会被浏览器跨域拦截；如无法生成，请填写代理地址。'
      : '如果你的中转站不允许浏览器跨域，请填写代理地址，否则手机网页会卡在请求阶段。'
}

function renderStyleChips() {
  $('#styleChips').innerHTML = STYLE_PRESETS.map((item) => `
    <button class="choice-chip ${item.id === state.prefs.style ? 'is-active' : ''}" data-style="${escapeHtml(item.id)}" type="button">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.hint)}</span>
    </button>
  `).join('')
}

function renderSizeChips() {
  $('#sizeChips').innerHTML = SIZE_PRESETS.map((item) => `
    <button class="mini-chip ${item.id === state.prefs.sizePreset ? 'is-active' : ''}" data-size="${escapeHtml(item.id)}" type="button">
      ${escapeHtml(item.chip)}
    </button>
  `).join('')
}

function renderCountChips() {
  $('#countChips').innerHTML = COUNT_PRESETS.map((item) => `
    <button class="mini-chip ${item === state.prefs.count ? 'is-active' : ''}" data-count="${item}" type="button">
      ${item} 张
    </button>
  `).join('')
}

function renderHistory() {
  const list = $('#historyList')
  if (!state.history.length) {
    list.innerHTML = `
      <div class="history-empty">
        <strong>还没有历史记录</strong>
        <p>生成过的提示词会收在这里，方便一键继续。</p>
      </div>
    `
    return
  }

  list.innerHTML = state.history.map((item) => `
    <button class="history-item" data-history-id="${escapeHtml(item.id)}" type="button">
      <div class="history-item-top">
        <strong>${escapeHtml(item.mode === 'edit' ? '图生图' : '文生图')}</strong>
        <span>${escapeHtml(item.time)}</span>
      </div>
      <p>${escapeHtml(item.prompt)}</p>
    </button>
  `).join('')
}

function renderSource() {
  const hasSource = Boolean(state.source)
  $('#sourcePreview').hidden = !hasSource
  $('#sourceEmpty').hidden = hasSource
  if (hasSource) {
    $('#sourcePreview').src = state.source.previewUrl
    setMode('edit')
  } else if (state.mode === 'edit' && !state.prefs.continueFromLast) {
    setMode('text')
  }
}

function renderViewer() {
  const viewer = $('#resultViewer')
  const current = selectedResult()
  if (!current) {
    viewer.innerHTML = `
      <div class="result-placeholder">
        <div class="placeholder-orb">G2</div>
        <p>生成结果会在这里成为主视觉。</p>
      </div>
    `
    $('#thumbStrip').innerHTML = ''
    return
  }

  viewer.innerHTML = `
    <div class="result-stage">
      <img class="result-image" src="${escapeHtml(current.previewUrl)}" alt="" />
      <div class="result-overlay">
        <div class="overlay-copy">
          <span class="caption-label">${escapeHtml(state.mode === 'edit' ? '图生图' : '文生图')}</span>
          <strong>${escapeHtml(current.prompt)}</strong>
        </div>
        <div class="overlay-actions">
          <button id="saveCurrentInline" class="tiny-chip" type="button">保存</button>
          <button id="setCurrentAsSourceInline" class="tiny-chip strong" type="button">参考</button>
        </div>
      </div>
    </div>
  `

  $('#thumbStrip').innerHTML = state.results.map((item, index) => `
    <button class="thumb-tile ${index === state.selectedIndex ? 'is-active' : ''}" data-result-index="${index}" type="button">
      <img src="${escapeHtml(item.previewUrl)}" alt="" />
    </button>
  `).join('')
}

function syncSettingsInputs() {
  $('#baseUrlInput').value = state.runtimeProxy ? '由本地代理托管' : state.settings.baseUrl
  $('#proxyUrlInput').value = state.runtimeProxy ? SAME_ORIGIN_PROXY_PATH : state.settings.proxyUrl
  $('#apiKeyInput').value = state.runtimeProxy ? '由本地代理保管' : state.settings.apiKey
  $('#modelInput').value = state.settings.model
  $('#generationEndpointInput').value = state.settings.generationEndpoint
  $('#editEndpointInput').value = state.settings.editEndpoint
  applyRuntimeSettingsState()
}

function applyRuntimeSettingsState() {
  const lockInputs = ['baseUrlInput', 'proxyUrlInput', 'apiKeyInput', 'modelInput', 'generationEndpointInput', 'editEndpointInput']
  for (const inputId of lockInputs) {
    const node = document.getElementById(inputId)
    if (!node) continue
    node.disabled = state.runtimeProxy
  }
  const saveButton = $('#saveSettings')
  saveButton.disabled = state.runtimeProxy
  saveButton.textContent = state.runtimeProxy ? '已托管' : '保存'
}

function persistSettings() {
  saveJson(SETTINGS_KEY, state.settings)
}

function persistPrefs() {
  saveJson(PREFS_KEY, state.prefs)
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, MAX_HISTORY)))
}

function addHistory(prompt, mode) {
  state.history.unshift({
    id: uniqueId(),
    prompt,
    mode,
    time: nowLabel(),
  })
  state.history = state.history.slice(0, MAX_HISTORY)
  persistHistory()
  renderHistory()
}

function promptValue() {
  return $('#promptInput').value.trim()
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function dataUrlToBlob(dataUrl) {
  const [header, body] = String(dataUrl).split(',')
  const mime = (header.match(/data:(.*?);base64/) || [])[1] || 'image/png'
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('读取参考图片失败')
  }
  const blob = await response.blob()
  return {
    dataUrl: await fileToDataUrl(new File([blob], 'result.png', { type: blob.type || 'image/png' })),
    mime: blob.type || 'image/png',
  }
}

async function setSourceFromFile(file) {
  const dataUrl = await fileToDataUrl(file)
  state.source = {
    dataUrl,
    previewUrl: dataUrl,
    name: file.name || 'source.png',
    mime: file.type || 'image/png',
  }
  renderSource()
  toast('参考图已就位')
}

async function setSourceFromCurrentResult() {
  const current = selectedResult()
  if (!current) {
    throw new Error('先生成一张图片，再把它设为参考图。')
  }
  if (current.dataUrl) {
    state.source = {
      dataUrl: current.dataUrl,
      previewUrl: current.previewUrl,
      name: current.name,
      mime: current.mime,
    }
  } else {
    const fetched = await fetchImageAsDataUrl(current.previewUrl)
    state.source = {
      dataUrl: fetched.dataUrl,
      previewUrl: current.previewUrl,
      name: current.name,
      mime: fetched.mime,
    }
  }
  renderSource()
  toast('已把当前结果设为参考图')
}

function clearSource() {
  state.source = null
  renderSource()
}

function currentRootUrl() {
  return state.settings.proxyUrl.trim() || state.settings.baseUrl.trim()
}

function usesAsyncJobMode() {
  return state.runtimeProxy && Boolean(state.runtimeConfig?.asyncJobs)
}

function getJobPath(kind) {
  return kind === 'edit'
    ? (state.runtimeConfig?.jobEditPath || '/api/edit')
    : (state.runtimeConfig?.jobGeneratePath || '/api/generate')
}

function getProgressPath(jobId) {
  const target = new URL(state.runtimeConfig?.jobProgressPath || '/api/progress', window.location.origin)
  target.searchParams.set('id', jobId)
  return target.toString()
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function resolveResourceUrl(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) {
    return value
  }
  if (/^https?:\/\//i.test(value)) {
    return value
  }
  if (value.startsWith('/')) {
    return new URL(value, window.location.origin).href
  }

  const root = currentRootUrl()
  if (/^https?:\/\//i.test(root)) {
    return new URL(value, `${normalizeBaseUrl(root)}/`).href
  }
  if (root.startsWith('/')) {
    return new URL(`${normalizeBaseUrl(root)}/${value.replace(/^\/+/, '')}`, window.location.origin).href
  }
  return value
}

function ensureConfigReady() {
  if (!state.settings.baseUrl.trim() && !state.settings.proxyUrl.trim()) {
    throw new Error('先到设置里填写 API 地址或代理地址。')
  }
  if (!usesManagedAuth() && !state.settings.apiKey.trim()) {
    throw new Error('先到设置里填写 API Key。')
  }
  if (!state.settings.model.trim()) {
    throw new Error('先到设置里填写模型名。')
  }
}

function buildAuthHeaders(extraHeaders = {}) {
  if (usesManagedAuth() || isSameOriginProxy(state.settings.proxyUrl)) {
    return { ...extraHeaders }
  }
  return {
    ...extraHeaders,
    Authorization: `Bearer ${state.settings.apiKey.trim()}`,
  }
}

async function parseResponseData(response) {
  const text = await response.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`服务返回了非 JSON 内容，HTTP ${response.status}`)
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || data?.detail || `请求失败，HTTP ${response.status}`
    throw new Error(message)
  }
  return data
}

function applyAsyncJobSnapshot(snapshot) {
  const elapsed = Number(snapshot?.elapsed_seconds || 0)
  if (snapshot?.phase === 'failed') {
    setStatus('Generation failed', snapshot?.error || 'Request failed')
    return
  }
  if (snapshot?.done) {
    setStatus('Generation complete', `Waited ${elapsed}s`)
    return
  }
  setStatus('Generating', `Waited ${elapsed}s`)
}

async function submitAsyncJob(kind, body, headers = {}) {
  let response
  try {
    response = await fetch(getJobPath(kind), {
      method: 'POST',
      headers,
      body,
    })
  } catch (error) {
    throw new Error(error.message || String(error))
  }
  const data = await parseResponseData(response)
  const jobId = data?.job_id || data?.request_id || data?.id
  if (!jobId) {
    throw new Error('No job id returned by server.')
  }
  state.activeJobId = jobId
  return jobId
}

async function pollAsyncJob(jobId) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    let response
    try {
      response = await fetch(getProgressPath(jobId), {
        cache: 'no-store',
      })
    } catch (error) {
      throw new Error(error.message || String(error))
    }
    const data = await parseResponseData(response)
    applyAsyncJobSnapshot(data)
    if (data?.done) {
      if (!data?.success) {
        throw new Error(data?.error || 'Generation failed')
      }
      return data?.result || data
    }
    await sleep(1500)
  }
  throw new Error('Generation timed out. Please try again.')
}

async function requestModelList() {
  ensureConfigReady()
  const url = joinUrl(currentRootUrl(), state.settings.modelsEndpoint)
  let response
  try {
    response = await fetch(url, {
      headers: buildAuthHeaders(),
    })
  } catch (error) {
    throw new Error(`模型连接失败。${state.runtimeProxy ? '请确认本地代理服务仍在运行。' : '若手机网页直连受限，请填写代理地址。'}${error.message ? ` 原因：${error.message}` : ''}`)
  }
  return parseResponseData(response)
}

function extractImagesFromResponse(data) {
  const items = Array.isArray(data?.data) ? data.data : []
  return items
    .map((item, index) => {
      if (item?.b64_json) {
        const dataUrl = `data:image/png;base64,${item.b64_json}`
        return {
          id: uniqueId(),
          previewUrl: dataUrl,
          dataUrl,
          name: `gpt-image-2-${Date.now()}-${index + 1}.png`,
          mime: 'image/png',
          prompt: promptValue(),
          label: `结果 ${index + 1}`,
        }
      }
      if (item?.url) {
        return {
          id: uniqueId(),
          previewUrl: resolveResourceUrl(item.url),
          dataUrl: null,
          name: `gpt-image-2-${Date.now()}-${index + 1}.png`,
          mime: 'image/png',
          prompt: promptValue(),
          label: `结果 ${index + 1}`,
        }
      }
      return null
    })
    .filter(Boolean)
}

function buildGeneratePayload() {
  const size = getSelectedSize()
  const style = getSelectedStyle()
  return {
    model: state.settings.model.trim(),
    prompt: `${promptValue()}${style.id ? `，风格倾向：${style.id}` : ''}`,
    size: size.size,
    quality: state.settings.quality || 'high',
    response_format: state.settings.responseFormat || 'b64_json',
    background: state.settings.background || 'auto',
  }
}

async function runSingleGeneration() {
  if (usesAsyncJobMode()) {
    const jobId = await submitAsyncJob(
      'generate',
      JSON.stringify(buildGeneratePayload()),
      { 'Content-Type': 'application/json' },
    )
    const data = await pollAsyncJob(jobId)
    const images = extractImagesFromResponse(data)
    if (!images.length) {
      throw new Error('The job completed but returned no image data.')
    }
    return images
  }

  const url = joinUrl(currentRootUrl(), state.settings.generationEndpoint)
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(buildGeneratePayload()),
    })
  } catch (error) {
    throw new Error(`生成请求未能发出。${state.runtimeProxy ? '请确认本地代理服务仍在运行。' : '若供应商不支持浏览器跨域，请填写代理地址。'}${error.message ? ` 原因：${error.message}` : ''}`)
  }
  const data = await parseResponseData(response)
  const images = extractImagesFromResponse(data)
  if (!images.length) {
    throw new Error('接口返回成功，但没有拿到图片数据。')
  }
  return images
}

async function runSingleEdit() {
  const source = state.source
  if (!source) {
    throw new Error('图生图需要先上传参考图。')
  }
  const size = getSelectedSize()
  const form = new FormData()
  form.append('model', state.settings.model.trim())
  form.append('prompt', `${promptValue()}${getSelectedStyle().id ? `，风格倾向：${getSelectedStyle().id}` : ''}`)
  form.append('size', size.size)
  form.append('quality', state.settings.quality || 'high')
  form.append('response_format', state.settings.responseFormat || 'b64_json')
  form.append('image', new File([dataUrlToBlob(source.dataUrl)], source.name, { type: source.mime }))

  if (usesAsyncJobMode()) {
    const jobId = await submitAsyncJob('edit', form)
    const data = await pollAsyncJob(jobId)
    const images = extractImagesFromResponse(data)
    if (!images.length) {
      throw new Error('The edit job completed but returned no image data.')
    }
    return images
  }

  const url = joinUrl(currentRootUrl(), state.settings.editEndpoint)
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: form,
    })
  } catch (error) {
    throw new Error(`图生图请求未能发出。${state.runtimeProxy ? '请确认本地代理服务仍在运行。' : '若供应商不支持浏览器跨域，请填写代理地址。'}${error.message ? ` 原因：${error.message}` : ''}`)
  }
  const data = await parseResponseData(response)
  const images = extractImagesFromResponse(data)
  if (!images.length) {
    throw new Error('接口返回成功，但没有拿到编辑结果。')
  }
  return images
}

async function generateImages() {
  if (state.busy) {
    return
  }
  ensureConfigReady()
  if (!promptValue()) {
    throw new Error('提示词不能为空。')
  }
  if (state.mode === 'edit' && !state.source && !state.prefs.continueFromLast) {
    throw new Error('图生图模式下请先上传参考图。')
  }
  if (!state.source && state.prefs.continueFromLast && selectedResult()) {
    await setSourceFromCurrentResult()
  }

  setBusy(true)
  state.activeJobId = ''
  setStatus('正在生成', '模型正在雕刻画面，请稍候。')

  try {
    const jobs = Array.from({ length: state.prefs.count }, () =>
      state.mode === 'edit' ? runSingleEdit() : runSingleGeneration(),
    )
    const settled = await Promise.allSettled(jobs)
    const successGroups = settled
      .filter((item) => item.status === 'fulfilled')
      .flatMap((item) => item.value)
    const failures = settled
      .filter((item) => item.status === 'rejected')
      .map((item) => item.reason?.message || String(item.reason))

    if (!successGroups.length) {
      throw new Error(failures[0] || '生成失败')
    }

    state.results = successGroups.map((item, index) => ({
      ...item,
      label: `结果 ${index + 1}`,
      prompt: promptValue(),
    }))
    state.selectedIndex = state.results.length - 1
    renderViewer()
    addHistory(promptValue(), state.mode)
    setStatus(
      failures.length ? '部分完成' : '生成完成',
      failures.length ? `成功 ${state.results.length} 张，失败 ${failures.length} 张。` : `共生成 ${state.results.length} 张图片。`,
    )
    toast(failures.length ? '已有可用结果，但部分请求失败。' : '图片生成完成')
  } finally {
    setBusy(false)
  }
}

async function shareCurrentImage() {
  const current = selectedResult()
  if (!current) {
    throw new Error('还没有可保存的图片。')
  }
  const blob = current.dataUrl ? dataUrlToBlob(current.dataUrl) : await (await fetch(current.previewUrl)).blob()
  const file = new File([blob], current.name, { type: blob.type || 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'GPT-image-2.0',
      text: current.prompt,
    })
    return
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = current.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

async function testConnection() {
  setStatus('正在测试', '尝试读取模型列表，检查当前配置是否可用。')
  try {
    const data = await requestModelList()
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : []
    const modelNames = items.slice(0, 4).map((item) => item.id || item.model).filter(Boolean)
    setStatus('连接成功', modelNames.length ? `已读到模型：${modelNames.join('、')}` : '模型接口可访问。')
    toast('连接测试通过')
  } catch (error) {
    setStatus('连接失败', error.message || String(error))
    toast('连接测试失败')
    throw error
  }
}

function saveSettingsFromForm() {
  if (state.runtimeProxy) {
    openSheet('settingsSheet', false)
    setStatus('本地代理模式', '当前由这台电脑代管接口配置，前端设置已锁定。')
    toast('本地代理模式下无需保存前端接口设置')
    return
  }
  state.settings = {
    ...state.settings,
    baseUrl: $('#baseUrlInput').value.trim(),
    proxyUrl: $('#proxyUrlInput').value.trim(),
    apiKey: $('#apiKeyInput').value.trim(),
    model: $('#modelInput').value.trim(),
    generationEndpoint: $('#generationEndpointInput').value.trim() || DEFAULT_SETTINGS.generationEndpoint,
    editEndpoint: $('#editEndpointInput').value.trim() || DEFAULT_SETTINGS.editEndpoint,
  }
  persistSettings()
  updateDock()
  openSheet('settingsSheet', false)
  setStatus('设置已保存', state.settings.proxyUrl ? '当前优先走代理模式。' : '当前优先直连供应商。')
  toast('设置已保存')
}

function bindEvents() {
  document.querySelectorAll('[data-open-sheet]').forEach((button) => {
    button.addEventListener('click', () => {
      openSheet(button.dataset.openSheet, true)
    })
  })

  document.querySelectorAll('[data-close-sheet]').forEach((button) => {
    button.addEventListener('click', () => {
      openSheet(button.dataset.closeSheet, false)
    })
  })

  $('#saveSettings').addEventListener('click', saveSettingsFromForm)
  $('#testConnection').addEventListener('click', () => {
    testConnection().catch((error) => console.error(error))
  })

  $('#generateButton').addEventListener('click', () => {
    generateImages().catch((error) => {
      setBusy(false)
      setStatus('生成失败', error.message || String(error))
      toast(error.message || String(error))
    })
  })

  $('#clearSource').addEventListener('click', clearSource)

  $('#sourceInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      await setSourceFromFile(file)
      openSheet('controlSheet', true)
    } catch (error) {
      setStatus('读取失败', error.message || String(error))
      toast(error.message || String(error))
    } finally {
      event.target.value = ''
    }
  })

  $('#continueToggle').addEventListener('change', (event) => {
    state.prefs.continueFromLast = Boolean(event.target.checked)
    persistPrefs()
  })

  $('#modeSwitch').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]')
    if (!button) return
    setMode(button.dataset.mode)
  })

  $('#styleChips').addEventListener('click', (event) => {
    const button = event.target.closest('[data-style]')
    if (!button) return
    state.prefs.style = button.dataset.style
    persistPrefs()
    renderStyleChips()
    updateDock()
  })

  $('#sizeChips').addEventListener('click', (event) => {
    const button = event.target.closest('[data-size]')
    if (!button) return
    state.prefs.sizePreset = button.dataset.size
    persistPrefs()
    renderSizeChips()
    updateDock()
  })

  $('#countChips').addEventListener('click', (event) => {
    const button = event.target.closest('[data-count]')
    if (!button) return
    state.prefs.count = Number(button.dataset.count)
    persistPrefs()
    renderCountChips()
  })

  $('#thumbStrip').addEventListener('click', (event) => {
    const button = event.target.closest('[data-result-index]')
    if (!button) return
    state.selectedIndex = Number(button.dataset.resultIndex)
    renderViewer()
  })

  $('#historyList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-history-id]')
    if (!button) return
    const item = state.history.find((entry) => entry.id === button.dataset.historyId)
    if (!item) return
    $('#promptInput').value = item.prompt
    setMode(item.mode)
    openSheet('historySheet', false)
    toast('已恢复这条提示词')
  })

  document.addEventListener('click', (event) => {
    if (event.target?.id === 'setCurrentAsSourceInline') {
      setSourceFromCurrentResult().catch((error) => {
        setStatus('参考图设置失败', error.message || String(error))
        toast(error.message || String(error))
      })
    }

    if (event.target?.id === 'saveCurrentInline') {
      shareCurrentImage().catch((error) => {
        setStatus('保存失败', error.message || String(error))
        toast(error.message || String(error))
      })
    }
  })
}

async function init() {
  renderStyleChips()
  renderSizeChips()
  renderCountChips()
  renderHistory()
  renderSource()
  renderViewer()
  await loadRuntimeProxyConfig()
  syncSettingsInputs()
  $('#continueToggle').checked = Boolean(state.prefs.continueFromLast)
  $('#promptInput').value = ''
  updateDock()
  setMode('text')
  if (state.runtimeProxy) {
    setStatus('本地代理已接管', '现在可以通过这台电脑同源出图，手机端不再直连中转站。')
  } else if (isBuiltInProvider() && !state.settings.proxyUrl) {
    setStatus('接口已接入', '手机网页若生成失败，请到设置里补代理。')
  }
  bindEvents()

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  }
}

init()
