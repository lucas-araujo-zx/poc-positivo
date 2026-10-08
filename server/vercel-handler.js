import { dispatchApi } from './plugin.js'

function tokenFrom(req) {
  const value = req.headers['x-positivo-token'] ?? req.headers['X-Positivo-Token']
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

function requestTarget(req) {
  const raw = req.url ?? '/'
  const url = new URL(raw, 'http://localhost')
  if (url.pathname.startsWith('/api/')) {
    return url
  }
  const parts = []
    .concat(req.query?.path ?? [])
    .flat()
    .filter(Boolean)
  const suffix = parts.map((part) => encodeURIComponent(part)).join('/')
  return new URL(`/api/${suffix}${url.search}`, 'http://localhost')
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
