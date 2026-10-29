import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
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

test('the Vercel build copies every module the handler imports', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const script = readFileSync(join(root, 'scripts/write-vercel-output.mjs'), 'utf8')
  const copied = new Set(['vercel-handler.js'])
  for (const match of script.matchAll(/server\/([^'"]+\.js)/g)) copied.add(match[1])
  const pending = ['vercel-handler.js']
  const seen = new Set()
  while (pending.length) {
    const file = pending.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(join(root, 'server', file), 'utf8')
    for (const match of source.matchAll(/from '\.\/([^']+\.js)'/g)) pending.push(match[1])
  }
  for (const file of seen) assert.ok(copied.has(file), file)
})

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
