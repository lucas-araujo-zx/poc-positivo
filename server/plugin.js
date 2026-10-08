import {
  agentDisplayName,
  isConversationId,
  parseAgentIds,
  readPlaceholders,
  shapeConversation,
  tokensMatch,
  WEBSITE_AGENT,
} from './agents.js'

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function requestUrl(req) {
  return new URL(req.url ?? '/', 'http://localhost')
}

function headerToken(req) {
  const value = req.headers['x-positivo-token']
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 4096) {
        reject(new Error('payload'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('json'))
      }
    })
    req.on('error', reject)
  })
}

function authError(token, env) {
  if (!env.loginToken) {
    return {
      status: 503,
      error: 'O acesso deste laboratório ainda não foi configurado.',
    }
  }
  if (!tokensMatch(token, env.loginToken)) {
    return { status: 401, error: 'Token inválido.' }
  }
  return null
}

function knownAgent(env, agentId) {
  return parseAgentIds(env.agentsRaw).includes(agentId) ? { id: agentId } : null
}

async function elevenFetch(env, path) {
  if (!env.apiKey) {
    return { ok: false, status: 503, error: 'A ElevenLabs ainda não foi configurada.' }
  }
  const response = await fetch(`https://api.elevenlabs.io${path}`, {
    headers: { 'xi-api-key': env.apiKey },
  })
  if (response.status === 401) {
    return { ok: false, status: 401, error: 'A chave da ElevenLabs foi recusada.' }
  }
  if (response.status === 404) {
    return {
      ok: false,
      status: 404,
      error:
        'Não encontrei esse agente na conta da ElevenLabs configurada. Use a chave dessa conta em ELEVENLABS_API_KEY.',
    }
  }
  if (!response.ok) {
    return { ok: false, status: 502, error: 'Não foi possível falar com a ElevenLabs.' }
  }
  return { ok: true, body: await response.json() }
}

export async function dispatchApi({ method, pathname, searchParams, token, body }, env) {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (path === '/api/login' && method === 'POST') {
    const error = authError(String(body?.token ?? '').trim(), env)
    if (error) {
      return { status: error.status, payload: { error: error.error } }
    }
    return { status: 200, payload: { ok: true } }
  }

  if (!path.startsWith('/api/')) {
    return null
  }

  if (method !== 'GET') {
    return { status: 405, payload: { error: 'Método não permitido.' } }
  }

  const error = authError(token, env)
  if (error) {
    return { status: error.status, payload: { error: error.error } }
  }

  if (path === '/api/catalog') {
    const ids = parseAgentIds(env.agentsRaw)
    const agents = await Promise.all(
      ids.map(async (id) => {
        const remote = await elevenFetch(env, `/v1/convai/agents/${id}`)
        if (!remote.ok) {
          return { id, name: '', error: remote.error }
        }
        return { id, name: agentDisplayName(remote.body), error: '' }
      }),
    )
    return {
      status: 200,
      payload: {
        agents,
        website: {
          ...WEBSITE_AGENT,
          path: '/loja',
        },
      },
    }
  }

  const setup = path.match(/^\/api\/agents\/([^/]+)\/setup$/)
  if (setup) {
    const agentId = decodeURIComponent(setup[1])
    const agent = knownAgent(env, agentId)
    if (!agent) {
      return { status: 404, payload: { error: 'Agente desconhecido.' } }
    }
    const remote = await elevenFetch(env, `/v1/convai/agents/${agent.id}`)
    if (!remote.ok) {
      return { status: remote.status, payload: { error: remote.error } }
    }
    return {
      status: 200,
      payload: {
        id: agent.id,
        name: agentDisplayName(remote.body),
        variables: readPlaceholders(remote.body),
      },
    }
  }

  if (path === '/api/signed-url') {
    const agentId = searchParams.get('agent_id') ?? ''
    if (!knownAgent(env, agentId)) {
      return { status: 404, payload: { error: 'Agente desconhecido.' } }
    }
    const remote = await elevenFetch(
      env,
      `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    )
    if (!remote.ok) {
      return { status: remote.status, payload: { error: remote.error } }
    }
    if (typeof remote.body?.signed_url !== 'string' || !remote.body.signed_url) {
      return { status: 502, payload: { error: 'A ElevenLabs não devolveu a sessão.' } }
    }
    return { status: 200, payload: { signedUrl: remote.body.signed_url } }
  }

  const conversation = path.match(/^\/api\/conversations\/([^/]+)$/)
  if (conversation) {
    const conversationId = decodeURIComponent(conversation[1])
    const agentId = searchParams.get('agent_id') ?? ''
    if (!isConversationId(conversationId) || !knownAgent(env, agentId)) {
      return { status: 404, payload: { error: 'Conversa desconhecida.' } }
    }
    const remote = await elevenFetch(
      env,
      `/v1/convai/conversations/${conversationId}`,
    )
    if (!remote.ok) {
      return { status: remote.status, payload: { error: remote.error } }
    }
    const result = shapeConversation(remote.body)
    if (result.agentId && result.agentId !== agentId) {
      return { status: 404, payload: { error: 'Conversa desconhecida.' } }
    }
    return { status: 200, payload: result }
  }

  return { status: 404, payload: { error: 'Não encontrado.' } }
}

export function labApiPlugin(env) {
  const safe = {
    loginToken: env.loginToken?.trim() ?? '',
    agentsRaw: env.agentsRaw ?? '',
    apiKey: env.apiKey?.trim() ?? '',
  }

  const attach = (middlewares) => {
    middlewares.use((req, res, next) => {
      const url = requestUrl(req)
      if (!url.pathname.startsWith('/api/')) {
        next()
        return
      }
      void (async () => {
        const body = req.method === 'POST' ? await readBody(req) : undefined
        return dispatchApi(
          {
            method: req.method ?? 'GET',
            pathname: url.pathname,
            searchParams: url.searchParams,
            token: headerToken(req),
            body,
          },
          safe,
        )
      })()
        .then((result) => {
          if (!result) {
            next()
            return
          }
          json(res, result.status, result.payload)
        })
        .catch((error) => {
          if (!res.headersSent) {
            const invalid = error instanceof Error && (error.message === 'json' || error.message === 'payload')
            json(res, invalid ? 400 : 500, {
              error: invalid ? 'Não consegui ler o token.' : 'Falha interna.',
            })
          }
        })
    })
  }

  return {
    name: 'positivo-lab-api',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}
