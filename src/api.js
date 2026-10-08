const TOKEN_KEY = 'positivo.lab.token'

export function readToken() {
  return sessionStorage.getItem(TOKEN_KEY) ?? ''
}

export function writeToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', token = '', body } = {}) {
  const headers = {}
  if (token) {
    headers['x-positivo-token'] = token
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Não foi possível concluir o pedido.')
  }
  return payload
}

export function login(token) {
  return request('/api/login', { method: 'POST', body: { token } })
}

export function catalog(token) {
  return request('/api/catalog', { token })
}

export function agentSetup(token, agentId) {
  return request(`/api/agents/${encodeURIComponent(agentId)}/setup`, { token })
}

export function signedUrl(token, agentId) {
  return request(`/api/signed-url?agent_id=${encodeURIComponent(agentId)}`, {
    token,
  })
}

export function conversation(token, agentId, conversationId) {
  const params = new URLSearchParams({ agent_id: agentId })
  return request(
    `/api/conversations/${encodeURIComponent(conversationId)}?${params}`,
    { token },
  )
}
