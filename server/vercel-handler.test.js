import assert from 'node:assert/strict'
import test from 'node:test'
import handler from './vercel-handler.js'

function call(method, url, { token = 'segredo-local', path = '', agents = 'agent_abcdefgh' } = {}) {
  process.env.POSITIVO_LOGIN_TOKEN = 'segredo-local'
  process.env.POSITIVO_AGENTS = agents
  process.env.ELEVENLABS_API_KEY = ''
  let statusCode = 0
  let payload
  const headers = {}
  if (token) headers['x-positivo-token'] = token
  if (path) headers['x-positivo-path'] = path
  const req = { method, url, headers, body: method === 'POST' ? { token } : undefined }
  const res = {
    headersSent: false,
    status(code) {
      statusCode = code
      return this
    },
    json(data) {
      payload = data
      this.headersSent = true
      return this
    },
  }
  return handler(req, res).then(() => ({ statusCode, payload }))
}

test('rewritten agent routes keep the path from the page', async () => {
  const setup = await call('GET', '/api/login', {
    path: '/api/agents/agent_abcdefgh/setup',
  })
  assert.equal(setup.statusCode, 503)
  assert.match(setup.payload.error, /ElevenLabs/)

  const catalog = await call('GET', '/api/catalog')
  assert.equal(catalog.statusCode, 200)
  assert.deepEqual(catalog.payload.agents, [
    {
      id: 'agent_abcdefgh',
      name: '',
      error: 'A ElevenLabs ainda não foi configurada.',
    },
  ])

  const signed = await call('GET', '/api/login?agent_id=agent_abcdefgh', {
    path: '/api/signed-url',
  })
  assert.equal(signed.statusCode, 503)
  assert.match(signed.payload.error, /ElevenLabs/)
})
