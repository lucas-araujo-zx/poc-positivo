import assert from 'node:assert/strict'
import test from 'node:test'
import { dispatchApi } from './plugin.js'
import {
  assignNumber,
  buildTemplateParams,
  campaignNameError,
  columnsFor,
  collectVariables,
  mapSheet,
  normalizeWhatsAppUserId,
  outboundPayload,
  parseCsv,
  pauseAfterLimitMs,
  sampleCsv,
  sendBatch,
  shapeTemplate,
} from './whatsapp.js'

const env = {
  loginToken: 'segredo',
  agentsRaw: 'agent_abcdefgh',
  apiKey: 'sk_test',
}

const cartAgent = {
  name: 'Positivo - Recuperação de Carrinho Abandonado',
  conversation_config: {
    agent: {
      dynamic_variables: {
        dynamic_variable_placeholders: {
          nome_cliente: '',
          nome_fantasia: 'Oficina Sul',
          system__agent_id: 'agent_x',
        },
      },
      prompt: { prompt: 'Fale com {{nome_cliente}} da {{empresa_extra}}.' },
    },
  },
}

const account = {
  phone_number_id: '1021913851014267',
  business_account_id: '1267399502249918',
  business_account_name: 'MIA - SDR - B2B',
  phone_number_name: 'MIA - SDR - B2B',
  phone_number: '+55 41 9252-3862',
  assigned_agent_id: 'agent_abcdefgh',
  assigned_agent_name: 'Carrinho',
  enable_messaging: true,
  is_token_expired: false,
}

const staticTemplate = {
  name: 'template_4_mia',
  language: 'pt_BR',
  parameter_format: 'POSITIONAL',
  category: 'MARKETING',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'MIA | POSITIVO EMPRESAS' },
    { type: 'BODY', text: 'Olá! Tudo bem?' },
    { type: 'CALL_PERMISSION_REQUEST' },
  ],
}

test('normalizeWhatsAppUserId accepts local, formatted and RS numbers', () => {
  assert.equal(normalizeWhatsAppUserId('+55 (41) 98888-7777').id, '5541988887777')
  assert.equal(normalizeWhatsAppUserId('041988887777').id, '5541988887777')
  assert.equal(normalizeWhatsAppUserId('4133334444').id, '554133334444')
  assert.equal(normalizeWhatsAppUserId('55999998888').id, '5555999998888')
  assert.equal(normalizeWhatsAppUserId('5541999998888').id, '5541999998888')
  assert.equal(normalizeWhatsAppUserId('').ok, false)
  assert.equal(normalizeWhatsAppUserId('123').ok, false)
})

test('collectVariables keeps declared fields, prompt fields and drops system keys', () => {
  assert.deepEqual(
    collectVariables(cartAgent).map((item) => item.name),
    ['nome_cliente', 'nome_fantasia', 'empresa_extra'],
  )
})

test('columns follow the agent and grow when the template has parameters', () => {
  const variables = collectVariables(cartAgent)
  const base = columnsFor(variables, null).map((column) => column.key)
  assert.deepEqual(base, ['whatsapp_user_id', 'nome_cliente', 'nome_fantasia', 'empresa_extra'])

  const named = shapeTemplate({
    name: 'welcome',
    language: 'pt_BR',
    parameter_format: 'NAMED',
    components: [{ type: 'BODY', text: 'Olá {{nome_cliente}}, pedido {{pedido}}.' }],
  })
  const columns = columnsFor(variables, named)
  const shared = columns.find((column) => column.key === 'nome_cliente')
  assert.equal(shared.kind, 'both')
  assert.equal(shared.required, true)
  assert.equal(columns.find((column) => column.key === 'nome_fantasia').required, false)
  assert.equal(columns.find((column) => column.key === 'pedido').required, true)
})

test('static Positivo templates add no parameter columns', () => {
  const shaped = shapeTemplate(staticTemplate)
  assert.equal(shaped.parameters.length, 0)
  assert.equal(shaped.requestsCallPermission, true)
  assert.equal(shaped.header, 'MIA | POSITIVO EMPRESAS')
  assert.equal(shapeTemplate({ ...staticTemplate, name: 'old', status: 'REJECTED' }), null)
})

test('buildTemplateParams keeps component wrappers and named parameter names', () => {
  const template = shapeTemplate({
    name: 'pedido',
    language: 'pt_BR',
    parameter_format: 'NAMED',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Olá {{nome}}' },
      { type: 'BODY', text: 'Seu pedido {{pedido}} segue.' },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'Abrir', url: 'https://loja.exemplo/{{pedido}}' }],
      },
    ],
  })
  assert.deepEqual(buildTemplateParams(template.parameters, { nome: 'Ana', pedido: '42' }), [
    {
      type: 'header',
      parameters: [{ type: 'text', text: 'Ana', parameter_name: 'nome' }],
    },
    {
      type: 'body',
      parameters: [{ type: 'text', text: '42', parameter_name: 'pedido' }],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: '42', parameter_name: 'pedido' }],
    },
  ])
})

test('positional body and media header become the columns the file must have', () => {
  const template = shapeTemplate({
    name: 'foto',
    language: 'pt_BR',
    parameter_format: 'POSITIONAL',
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Olá {{1}}, seu item é {{2}}.' },
    ],
  })
  assert.deepEqual(
    buildTemplateParams(template.parameters, {
      header_image: 'https://cdn.exemplo/a.jpg',
      body_1: 'Ana',
      body_2: 'Notebook',
    }),
    [
      { type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn.exemplo/a.jpg' } }] },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Ana' },
          { type: 'text', text: 'Notebook' },
        ],
      },
    ],
  )
})

test('parseCsv reads a Brazilian spreadsheet and maps phone aliases', () => {
  const csv = parseCsv('telefone;nome_cliente;obs\n"(41) 98888-7777";Ana;oi\n')
  const columns = columnsFor([{ name: 'nome_cliente', placeholder: 'Ana' }], null)
  const mapped = mapSheet(csv.headers, csv.rows, columns)
  assert.deepEqual(mapped.missingColumns, [])
  assert.deepEqual(mapped.unknown, ['obs'])
  assert.equal(mapped.rows[0].ok, true)
  assert.equal(mapped.rows[0].whatsappUserId, '5541988887777')
  assert.equal(mapped.rows[0].values.nome_cliente, 'Ana')
})

test('an empty agent variable does not block the row', () => {
  const columns = columnsFor([{ name: 'nome_cliente', placeholder: 'Ana' }], null)
  const mapped = mapSheet(
    ['telefone', 'nome_cliente'],
    [
      ['41988887777', ''],
      ['41977776666', null],
    ],
    columns,
  )
  assert.deepEqual(mapped.missingColumns, [])
  assert.equal(mapped.rows[0].ok, true)
  assert.equal(mapped.rows[0].values.nome_cliente, '')
  assert.equal(mapped.rows[1].ok, true)

  const withoutColumn = mapSheet(['telefone'], [['41988887777']], columns)
  assert.deepEqual(withoutColumn.missingColumns, [])
  assert.equal(withoutColumn.rows[0].ok, true)

  const template = shapeTemplate(staticTemplate)
  const payload = outboundPayload({
    agentId: 'agent_abcdefgh',
    phoneNumberId: account.phone_number_id,
    template,
    columns,
    values: { whatsapp_user_id: '5541988887777', nome_cliente: '' },
    whatsappUserId: '5541988887777',
    campaignName: 'carrinho-2026-10-29',
  })
  assert.deepEqual(payload.conversation_initiation_client_data.dynamic_variables, {
    campanha: 'carrinho-2026-10-29',
  })
})

test('sampleCsv is the header the operator downloads', () => {
  const columns = columnsFor([{ name: 'nome_cliente', placeholder: 'Ana' }], null)
  assert.equal(sampleCsv(columns), '\uFEFFwhatsapp_user_id;nome_cliente\n')
})

test('outbound payload separates template text from agent variables', () => {
  const template = shapeTemplate(staticTemplate)
  const columns = columnsFor([{ name: 'nome_cliente', placeholder: 'Ana' }], template)
  const payload = outboundPayload({
    agentId: 'agent_abcdefgh',
    phoneNumberId: account.phone_number_id,
    template,
    columns,
    values: { whatsapp_user_id: '5541988887777', nome_cliente: 'Ana' },
    whatsappUserId: '5541988887777',
    campaignName: 'carrinho-2026-10-29',
  })
  assert.deepEqual(payload.template_params, [])
  assert.equal(payload.template_name, 'template_4_mia')
  assert.equal(payload.template_language_code, 'pt_BR')
  assert.deepEqual(payload.conversation_initiation_client_data.dynamic_variables, {
    nome_cliente: 'Ana',
    campanha: 'carrinho-2026-10-29',
  })
  assert.equal(campaignNameError('lote:manha'), 'O nome do lote não pode conter dois-pontos.')
  assert.equal(
    columnsFor([{ name: 'campanha', placeholder: 'x' }, { name: 'nome_cliente', placeholder: 'Ana' }], null)
      .some((column) => column.key === 'campanha'),
    false,
  )
})

test('sendBatch refuses a batch without a name before calling ElevenLabs', async () => {
  const result = await sendBatch(
    {
      agentId: 'agent_abcdefgh',
      phoneNumberId: account.phone_number_id,
      templateName: 'template_4_mia',
      templateLanguage: 'pt_BR',
      recipients: [{ line: 2, values: { whatsapp_user_id: '41911112222' } }],
    },
    async () => {
      throw new Error('não deveria chamar a ElevenLabs')
    },
  )
  assert.equal(result.status, 400)
  assert.match(result.payload.error, /nome ao lote/)
})

test('mapSheet sends only the first row of a repeated number', () => {
  const columns = columnsFor([{ name: 'nome_cliente', placeholder: '' }], null)
  const mapped = mapSheet(
    ['telefone', 'nome_cliente'],
    [
      ['41988887777', 'Ana'],
      ['(41) 98888-7777', ''],
    ],
    columns,
  )
  assert.equal(mapped.rows[0].ok, true)
  assert.equal(mapped.rows[1].ok, false)
  assert.match(mapped.rows[1].error, /linha 2/)
  assert.equal(mapped.duplicates.length, 1)
})

test('pauseAfterLimitMs stays inside a short client wait', () => {
  assert.equal(pauseAfterLimitMs(500), 2000)
  assert.equal(pauseAfterLimitMs(5000), 5000)
  assert.equal(pauseAfterLimitMs(120000), 20000)
  assert.equal(pauseAfterLimitMs(0), 8000)
})

test('sendBatch posts one outbound message per valid row and stops on rate limit', async () => {
  const posts = []
  const fetchEleven = async (method, path, body) => {
    if (path.includes('/agents/')) return { ok: true, status: 200, body: cartAgent }
    if (path.endsWith('/whatsapp-accounts')) return { ok: true, status: 200, body: { items: [account] } }
    if (path.endsWith('/message-templates')) {
      return { ok: true, status: 200, body: { items: [staticTemplate] } }
    }
    posts.push(body)
    if (posts.length === 1) return { ok: true, status: 200, body: { conversation_id: 'conv_1' } }
    return { ok: false, status: 429, error: 'limite' }
  }
  const sleeps = []
  const result = await sendBatch(
    {
      agentId: 'agent_abcdefgh',
      phoneNumberId: account.phone_number_id,
      templateName: 'template_4_mia',
      templateLanguage: 'pt_BR',
      campaignName: 'carrinho-2026-10-29',
      recipients: [
        { line: 2, values: { whatsapp_user_id: '41911112222', nome_cliente: 'Ana', nome_fantasia: 'Sul', empresa_extra: 'Sul' } },
        { line: 3, values: { whatsapp_user_id: '123', nome_cliente: 'Bia', nome_fantasia: 'Sul', empresa_extra: 'Sul' } },
        { line: 4, values: { whatsapp_user_id: '41933334444', nome_cliente: 'Caio', nome_fantasia: 'Sul', empresa_extra: 'Sul' } },
        { line: 5, values: { whatsapp_user_id: '41955556666', nome_cliente: 'Duda', nome_fantasia: 'Sul', empresa_extra: 'Sul' } },
      ],
    },
    fetchEleven,
    { sleep: async (ms) => sleeps.push(ms) },
  )
  assert.equal(result.status, 200)
  assert.equal(result.payload.limited, true)
  assert.equal(posts.length, 3)
  assert.deepEqual(sleeps, [250, 1000])
  assert.equal(posts[0].whatsapp_user_id, '5541911112222')
  assert.equal(posts[0].template_params.length, 0)
  assert.equal(posts[0].conversation_initiation_client_data.dynamic_variables.campanha, 'carrinho-2026-10-29')
  assert.equal(posts[2].whatsapp_user_id, '5541933334444')
  assert.equal(result.payload.results[0].conversationId, 'conv_1')
  assert.match(result.payload.results[1].error, /DDD/)
  assert.equal(result.payload.results.some((item) => item.line === 4 || item.line === 5), false)
  assert.equal(result.payload.retryAfterMs, 8000)
})

test('sendBatch retries a rate limit once and keeps a refused request from repeating', async () => {
  const calls = []
  const fetchEleven = async (method, path, body) => {
    if (path.includes('/agents/')) return { ok: true, status: 200, body: cartAgent }
    if (path.endsWith('/whatsapp-accounts')) return { ok: true, status: 200, body: { items: [account] } }
    if (path.endsWith('/message-templates')) {
      return { ok: true, status: 200, body: { items: [staticTemplate] } }
    }
    calls.push(body.whatsapp_user_id)
    if (calls.length === 1) return { ok: false, status: 429, error: 'limite', retryAfterMs: 500 }
    if (calls.length === 2) return { ok: true, status: 200, body: { conversation_id: 'conv_retry' } }
    return { ok: false, status: 422, error: 'modelo recusado' }
  }
  const sleeps = []
  const result = await sendBatch(
    {
      agentId: 'agent_abcdefgh',
      phoneNumberId: account.phone_number_id,
      templateName: 'template_4_mia',
      templateLanguage: 'pt_BR',
      campaignName: 'carrinho-2026-10-29',
      recipients: [
        { line: 2, values: { whatsapp_user_id: '41911112222', nome_cliente: 'Ana' } },
        { line: 3, values: { whatsapp_user_id: '41922223333', nome_cliente: 'Bia' } },
      ],
    },
    fetchEleven,
    { sleep: async (ms) => sleeps.push(ms) },
  )
  assert.equal(result.payload.limited, false)
  assert.equal(result.payload.results[0].conversationId, 'conv_retry')
  assert.match(result.payload.results[1].error, /recusado/)
  assert.deepEqual(calls, ['5541911112222', '5541911112222', '5541922223333'])
  assert.deepEqual(sleeps, [1000, 250])
})

test('assignNumber links a workspace number and unlinks it with null', async () => {
  const calls = []
  const fetchEleven = async (method, path, body) => {
    calls.push({ method, path, body })
    if (path === '/v1/convai/whatsapp-accounts') {
      return { ok: true, status: 200, body: { items: [account] } }
    }
    return { ok: true, status: 200, body: {} }
  }
  const linked = await assignNumber(
    { phoneNumberId: account.phone_number_id, agentId: 'agent_abcdefgh' },
    fetchEleven,
  )
  assert.equal(linked.status, 200)
  assert.equal(linked.payload.assignedAgentId, 'agent_abcdefgh')
  const removed = await assignNumber(
    { phoneNumberId: account.phone_number_id, agentId: null },
    fetchEleven,
  )
  assert.equal(removed.payload.assignedAgentId, '')
  assert.deepEqual(
    calls.filter((call) => call.method === 'PATCH').map((call) => call.body),
    [
      { assigned_agent_id: 'agent_abcdefgh' },
      { assigned_agent_id: null },
    ],
  )
})

test('assignment route refuses an agent outside the workspace', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('não deveria chamar a ElevenLabs')
  }
  try {
    const denied = await dispatchApi(
      {
        method: 'POST',
        pathname: '/api/whatsapp/assignment',
        searchParams: new URLSearchParams(),
        token: 'segredo',
        body: { phoneNumberId: account.phone_number_id, agentId: 'agent_zzzzzzzz' },
      },
      env,
    )
    assert.equal(denied.status, 404)
  } finally {
    globalThis.fetch = original
  }
})

test('dispatch route rejects an unknown agent and lists setup from ElevenLabs', async () => {
  const unknown = await dispatchApi(
    {
      method: 'POST',
      pathname: '/api/whatsapp/dispatch',
      searchParams: new URLSearchParams(),
      token: 'segredo',
      body: { agentId: 'agent_nopexxxx', recipients: [{ line: 2, values: {} }] },
    },
    env,
  )
  assert.equal(unknown.status, 404)

  const denied = await dispatchApi(
    {
      method: 'GET',
      pathname: '/api/whatsapp/setup',
      searchParams: new URLSearchParams({ agent_id: 'agent_abcdefgh' }),
      token: 'errado',
    },
    env,
  )
  assert.equal(denied.status, 401)

  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const href = String(url)
    assert.equal(options.headers['xi-api-key'], 'sk_test')
    if (href.includes('/agents/')) return Response.json(cartAgent)
    if (href.endsWith('/message-templates')) {
      return Response.json({ items: [staticTemplate, { ...staticTemplate, name: 'old', status: 'REJECTED' }] })
    }
    if (href.endsWith('/whatsapp-accounts')) return Response.json({ items: [account] })
    return new Response('não', { status: 404 })
  }
  try {
    const setup = await dispatchApi(
      {
        method: 'GET',
        pathname: '/api/whatsapp/setup',
        searchParams: new URLSearchParams({ agent_id: 'agent_abcdefgh' }),
        token: 'segredo',
      },
      env,
    )
    assert.equal(setup.status, 200)
    assert.deepEqual(
      setup.payload.columns.map((column) => column.key),
      ['whatsapp_user_id', 'nome_cliente', 'nome_fantasia', 'empresa_extra'],
    )
    assert.equal(setup.payload.accounts[0].templates.length, 1)
    assert.equal(setup.payload.accounts[0].templates[0].name, 'template_4_mia')
  } finally {
    globalThis.fetch = original
  }
})
