import { dispatchApi } from './plugin.js'

function headerValue(req, name) {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

function tokenFrom(req) {
  return headerValue(req, 'x-positivo-token')
}

function apiTarget(value, searchParams) {
  if (!value || value.includes('://') || value.includes('..')) {
    return null
  }
  const url = new URL(value, 'http://localhost')
  if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
    return null
  }
  searchParams?.forEach((item, key) => {
    if (key !== '__positivo_path' && !url.searchParams.has(key)) {
      url.searchParams.append(key, item)
    }
  })
  return url
}

function requestTarget(req) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const hinted = apiTarget(headerValue(req, 'x-positivo-path'), url.searchParams)
  const method = (req.method ?? 'GET').toUpperCase()
  const rewritten =
    url.pathname === '/api' ||
    url.pathname === '/api/' ||
    url.pathname.includes('[') ||
    (url.pathname === '/api/login' && method !== 'POST')

  if (!rewritten && url.pathname.startsWith('/api/')) {
    return url
  }
  if (hinted) {
    return hinted
  }
  const parts = []
    .concat(req.query?.path ?? [])
    .flat()
    .filter(Boolean)
  if (parts.length) {
    const suffix = parts.map((part) => encodeURIComponent(part)).join('/')
    return new URL(`/api/${suffix}${url.search}`, 'http://localhost')
  }
  return url
}

async function jsonBody(req) {
  const body = req.body
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return body
  }
  if (typeof body === 'string') {
    return body.trim() ? JSON.parse(body) : {}
  }
  if (Buffer.isBuffer(body)) {
    const raw = body.toString('utf8')
    return raw.trim() ? JSON.parse(raw) : {}
  }
  if (req.method !== 'POST') {
    return undefined
  }
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.trim() ? JSON.parse(raw) : {}
}

export default async function handler(req, res) {
  try {
    const url = requestTarget(req)
    const result = await dispatchApi(
      {
        method: req.method ?? 'GET',
        pathname: url.pathname,
        searchParams: url.searchParams,
        token: tokenFrom(req),
        body: await jsonBody(req),
      },
      {
        loginToken: process.env.POSITIVO_LOGIN_TOKEN ?? '',
        agentsRaw: process.env.POSITIVO_AGENTS ?? '',
        apiKey: process.env.ELEVENLABS_API_KEY ?? '',
      },
    )
    res.status(result?.status ?? 404).json(result?.payload ?? { error: 'Não encontrado.' })
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Falha interna.' })
    }
  }
}
