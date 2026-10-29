const SKIP_VARIABLE = /^(system__|sip_)/i
const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/
const TEMPLATE_LANGUAGE = /^[a-z]{2}(?:_[A-Za-z]{2})?$/
const PHONE_NUMBER_ID = /^\d{6,24}$/
export const MAX_BATCH = 8
const MAX_ROWS = 2000
const OUTBOUND_GAP_MS = 250
const RATE_RETRY_WAIT_MS = 1000
const CLIENT_PAUSE_MIN_MS = 2000
const CLIENT_PAUSE_MAX_MS = 20000
const CLIENT_PAUSE_DEFAULT_MS = 8000
const BATCH_VARIABLE = 'campanha'
const MAX_CAMPAIGN_NAME = 80

const PHONE_ALIASES = [
  'telefone',
  'celular',
  'whatsapp',
  'phone',
  'numero',
  'fone',
  'whatsapp_user',
]

export function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function cleanValue(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, 1000)
}

export function cellToString(value) {
  if (value == null) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const utcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0
    const day = utcMidnight ? value.getUTCDate() : value.getDate()
    const month = (utcMidnight ? value.getUTCMonth() : value.getMonth()) + 1
    const year = utcMidnight ? value.getUTCFullYear() : value.getFullYear()
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value)
  }
  return String(value).trim()
}

export function normalizeWhatsAppUserId(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  digits = digits.replace(/^0+/, '')
  if (!digits) return { ok: false, error: 'Telefone vazio.' }
  // 10 or 11 digits is a Brazilian number with DDD. DDD 55 (RS) also starts with 55,
  // so the country code is added whenever the number is still the local length.
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  if (digits.length < 12 || digits.length > 15) {
    return { ok: false, error: 'Use o DDD e o número, com ou sem o 55.' }
  }
  return { ok: true, id: digits }
}

export function collectVariables(agent) {
  const map =
    agent?.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders
  const declared =
    map && typeof map === 'object' && !Array.isArray(map)
      ? Object.entries(map)
          .filter(([name]) => name && !SKIP_VARIABLE.test(name))
          .map(([name, placeholder]) => ({
            name,
            placeholder: placeholder == null ? '' : String(placeholder),
          }))
      : []
  const seen = new Set(declared.map((item) => item.name))
  const extras = []
  const texts = [
    agent?.conversation_config?.agent?.prompt?.prompt,
    agent?.conversation_config?.agent?.first_message,
  ]
  for (const text of texts) {
    if (typeof text !== 'string') continue
    for (const match of text.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) {
      const name = match[1]
      if (!name || SKIP_VARIABLE.test(name) || seen.has(name)) continue
      seen.add(name)
      extras.push({ name, placeholder: '' })
    }
  }
  return [...declared, ...extras]
}

function tokensIn(text, format) {
  if (typeof text !== 'string' || !text) return []
  const pattern =
    format === 'NAMED'
      ? /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g
      : /\{\{\s*(\d+)\s*\}\}/g
  return [...text.matchAll(pattern)].map((match) => match[1])
}

function textParameter({ key, component, token, formatName, hint, subType, index }) {
  return {
    key,
    component,
    format: 'text',
    parameterName: formatName === 'NAMED' ? token : undefined,
    position: formatName === 'POSITIONAL' ? Number(token) : undefined,
    subType,
    index,
    hint,
  }
}

function pushHeader(params, component, format) {
  const media = String(component?.format || 'TEXT').toUpperCase()
  if (media === 'IMAGE') {
    params.push({
      key: 'header_image',
      component: 'header',
      format: 'image',
      hint: 'URL pública https da imagem do cabeçalho.',
    })
    return
  }
  if (media === 'DOCUMENT') {
    params.push({
      key: 'header_document',
      component: 'header',
      format: 'document',
      hint: 'URL pública https do documento do cabeçalho.',
    })
    return
  }
  if (media === 'LOCATION') {
    const fields = [
      ['latitude', 'Latitude do local no cabeçalho.'],
      ['longitude', 'Longitude do local no cabeçalho.'],
      ['name', 'Nome do local no cabeçalho.'],
      ['address', 'Endereço do local no cabeçalho.'],
    ]
    for (const [field, hint] of fields) {
      params.push({
        key: `header_${field}`,
        component: 'header',
        format: 'location',
        locationField: field,
        hint,
      })
    }
    return
  }
  for (const token of tokensIn(component?.text, format)) {
    params.push(
      textParameter({
        key: format === 'NAMED' ? token : `header_${token}`,
        component: 'header',
        token,
        formatName: format,
        hint: `Cabeçalho, no lugar de {{${token}}}.`,
      }),
    )
  }
}

export function templateParameters(template) {
  const format = String(template?.parameter_format || 'POSITIONAL').toUpperCase()
  const components = Array.isArray(template?.components) ? template.components : []
  const params = []
  for (const component of components) {
    const type = String(component?.type || '').toUpperCase()
    if (type === 'HEADER') {
      pushHeader(params, component, format)
    } else if (type === 'BODY') {
      for (const token of tokensIn(component?.text, format)) {
        params.push(
          textParameter({
            key: format === 'NAMED' ? token : `body_${token}`,
            component: 'body',
            token,
            formatName: format,
            hint: `Corpo da mensagem, no lugar de {{${token}}}.`,
          }),
        )
      }
    } else if (type === 'BUTTONS' && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, index) => {
        if (String(button?.type || '').toUpperCase() !== 'URL') return
        const tokens = tokensIn(button.url || '', format)
        if (!tokens.length) return
        const token = tokens[0]
        params.push(
          textParameter({
            key: format === 'NAMED' ? token : `button_${index + 1}`,
            component: 'button',
            token,
            formatName: format,
            subType: 'url',
            index,
            hint: `Botão ${index + 1}, no lugar de {{${token}}}.`,
          }),
        )
      })
    }
  }
  return params
}

export function shapeTemplate(template) {
  if (!template || typeof template.name !== 'string' || !template.name.trim()) return null
  const status = String(template.status || template.template_status || '').toUpperCase()
  if (status && !['APPROVED', 'ACTIVE'].includes(status)) return null
  const components = Array.isArray(template.components) ? template.components : []
  const textOf = (type) => {
    const component = components.find(
      (item) => String(item?.type || '').toUpperCase() === type,
    )
    return typeof component?.text === 'string' ? component.text : ''
  }
  return {
    name: template.name.trim(),
    language: String(template.language || template.language_code || 'pt_BR'),
    category: String(template.category || ''),
    parameterFormat: String(template.parameter_format || 'POSITIONAL').toUpperCase(),
    header: textOf('HEADER'),
    body: textOf('BODY'),
    footer: textOf('FOOTER'),
    requestsCallPermission: components.some(
      (item) => String(item?.type || '').toUpperCase() === 'CALL_PERMISSION_REQUEST',
    ),
    parameters: templateParameters(template),
  }
}

export function shapeAccount(item) {
  const phoneNumberId = String(item?.phone_number_id || '')
  if (!PHONE_NUMBER_ID.test(phoneNumberId)) return null
  return {
    phoneNumberId,
    businessAccountId: String(item.business_account_id || ''),
    businessAccountName: String(item.business_account_name || ''),
    phoneNumberName: String(item.phone_number_name || ''),
    phoneNumber: String(item.phone_number || ''),
    assignedAgentId: item.assigned_agent_id ? String(item.assigned_agent_id) : '',
    assignedAgentName: item.assigned_agent_name ? String(item.assigned_agent_name) : '',
    messagingEnabled: item.enable_messaging !== false,
    tokenExpired: item.is_token_expired === true,
  }
}

export function columnsFor(variables, template) {
  const columns = [
    {
      key: 'whatsapp_user_id',
      required: true,
      kind: 'phone',
      hint: 'Número com DDD. Pode vir como 41999998888 ou 5541999998888. A coluna também pode se chamar telefone, celular ou whatsapp.',
      aliases: PHONE_ALIASES,
    },
  ]
  for (const variable of variables || []) {
    if (!variable?.name || SKIP_VARIABLE.test(variable.name) || variable.name === BATCH_VARIABLE) {
      continue
    }
    const placeholder = variable.placeholder ? String(variable.placeholder) : ''
    columns.push({
      key: variable.name,
      required: false,
      kind: 'variable',
      hint: placeholder
        ? `Variável do agente. Exemplo: ${placeholder}. Pode ficar em branco. Se vier preenchida, entra na conversa quando a pessoa responder.`
        : 'Variável do agente. Pode ficar em branco. Se vier preenchida, entra na conversa quando a pessoa responder.',
      aliases: [],
    })
  }
  for (const param of template?.parameters || []) {
    const existing = columns.find((column) => column.key === param.key)
    if (existing) {
      if (existing.kind === 'variable' || existing.kind === 'both') {
        existing.kind = 'both'
        existing.required = true
        existing.hint = `Preenche o modelo (${param.hint}) e a conversa quando a pessoa responder.`
      }
      existing.format = existing.format || param.format
      continue
    }
    columns.push({
      key: param.key,
      required: true,
      kind: 'template',
      format: param.format,
      hint: param.hint,
      aliases: [],
    })
  }
  return columns
}

export function planRecipient(columns, input) {
  const values = {}
  const missing = []
  for (const column of columns) {
    const value = cleanValue(input?.[column.key])
    values[column.key] = value
    if (column.required && !value) missing.push(column.key)
    if (
      (column.format === 'image' || column.format === 'document') &&
      value &&
      !/^https:\/\//i.test(value)
    ) {
      return {
        ok: false,
        error: `${column.key} precisa ser uma URL https.`,
        values,
        whatsappUserId: '',
      }
    }
  }
  const phone = normalizeWhatsAppUserId(values.whatsapp_user_id || '')
  if (!phone.ok) {
    return { ok: false, error: phone.error, values, whatsappUserId: '' }
  }
  values.whatsapp_user_id = phone.id
  const fields = missing.filter((key) => key !== 'whatsapp_user_id')
  if (fields.length) {
    return {
      ok: false,
      error: `Preencha: ${fields.join(', ')}.`,
      values,
      whatsappUserId: phone.id,
    }
  }
  return { ok: true, error: '', values, whatsappUserId: phone.id }
}

function countOutsideQuotes(line, delimiter) {
  let count = 0
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') index += 1
      else quoted = !quoted
      continue
    }
    if (!quoted && char === delimiter) count += 1
  }
  return count
}

function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((item) => item.trim()) || ''
  const commas = countOutsideQuotes(line, ',')
  const semis = countOutsideQuotes(line, ';')
  return semis > commas ? ';' : ','
}

export function parseCsv(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '')
  if (!source.trim()) return { error: 'O arquivo está vazio.' }
  const delimiter = detectDelimiter(source)
  const records = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === delimiter) {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      records.push(row)
      row = []
      field = ''
      continue
    }
    field += char
  }
  if (quoted) return { error: 'O CSV tem aspas sem fechar.' }
  if (field.length || row.length) {
    row.push(field)
    records.push(row)
  }
  if (!records.length || !records[0].some((cell) => String(cell).trim())) {
    return { error: 'Não encontrei o cabeçalho.' }
  }
  return {
    headers: records[0].map((cell) => String(cell).trim()),
    rows: records.slice(1),
    warning: source.includes('\uFFFD')
      ? 'O arquivo parece não estar em UTF-8. Prefira XLSX ou exporte o CSV em UTF-8.'
      : '',
  }
}

export function mapSheet(headers, rows, columns) {
  if (!Array.isArray(headers) || !headers.some((header) => String(header).trim())) {
    return { error: 'Não encontrei o cabeçalho.' }
  }
  if (!Array.isArray(rows)) return { error: 'Não encontrei linhas no arquivo.' }
  if (rows.length > MAX_ROWS) {
    return { error: 'O arquivo passa de 2000 linhas. Divida a planilha.' }
  }
  const used = new Set()
  const headerMap = []
  const unknown = []
  headers.forEach((header, index) => {
    const norm = normalizeHeader(header)
    if (!norm) return
    const column = columns.find(
      (item) =>
        !used.has(item.key) &&
        (normalizeHeader(item.key) === norm ||
          item.aliases.some((alias) => normalizeHeader(alias) === norm)),
    )
    if (!column) {
      unknown.push(String(header).trim())
      return
    }
    used.add(column.key)
    headerMap.push({ index, key: column.key })
  })
  const missingColumns = columns
    .filter((column) => column.required && !used.has(column.key))
    .map((column) => column.key)
  const parsed = []
  rows.forEach((row, index) => {
    const input = {}
    let any = false
    for (const item of headerMap) {
      const value = cleanValue(Array.isArray(row) ? row[item.index] : '')
      if (value) any = true
      input[item.key] = value
    }
    if (!any) return
    const planned = planRecipient(columns, input)
    parsed.push({
      line: index + 2,
      ok: planned.ok && missingColumns.length === 0,
      error: missingColumns.length
        ? `Faltam colunas: ${missingColumns.join(', ')}.`
        : planned.error,
      values: planned.values,
      whatsappUserId: planned.whatsappUserId,
    })
  })
  if (!parsed.length) {
    return {
      error: 'Nenhuma linha com dados. Preencha ao menos um contato abaixo do cabeçalho.',
      missingColumns,
      unknown,
      duplicates: [],
      rows: [],
    }
  }
  const byPhone = new Map()
  for (const item of parsed) {
    if (!item.whatsappUserId) continue
    const lines = byPhone.get(item.whatsappUserId) || []
    lines.push(item.line)
    byPhone.set(item.whatsappUserId, lines)
  }
  const duplicates = [...byPhone.entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([whatsappUserId, lines]) => ({ whatsappUserId, lines }))
  const firstLine = new Map()
  for (const item of parsed) {
    if (!item.ok || !item.whatsappUserId) continue
    const first = firstLine.get(item.whatsappUserId)
    if (first == null) {
      firstLine.set(item.whatsappUserId, item.line)
      continue
    }
    item.ok = false
    item.error = `Este número já está na linha ${first}. Só a primeira entra no disparo.`
  }
  return { missingColumns, unknown, duplicates, rows: parsed }
}

export function escapeCsv(value) {
  const text = String(value ?? '')
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function sampleCsv(columns) {
  return `\uFEFF${columns.map((column) => column.key).join(';')}\n`
}

function textParam(param, value) {
  const entry = { type: 'text', text: value }
  if (param.parameterName) entry.parameter_name = param.parameterName
  return entry
}

function filenameFromLink(link) {
  try {
    const name = decodeURIComponent(new URL(link).pathname.split('/').filter(Boolean).pop() || '')
    if (name && name.length <= 120) return name
  } catch {
    // The link is validated as https before send; a parse failure falls back to a generic name.
  }
  return 'documento'
}

export function buildTemplateParams(parameters, values) {
  const headerText = []
  const headerMedia = []
  let location = null
  const body = []
  const buttons = new Map()
  const ordered = [...(parameters || [])].sort(
    (left, right) => (left.position ?? 0) - (right.position ?? 0),
  )
  for (const param of ordered) {
    const value = cleanValue(values?.[param.key])
    if (param.component === 'body') {
      body.push(textParam(param, value))
    } else if (param.component === 'button') {
      const id = `${param.subType}:${param.index}`
      if (!buttons.has(id)) {
        buttons.set(id, { subType: param.subType, index: param.index, parameters: [] })
      }
      buttons.get(id).parameters.push(textParam(param, value))
    } else if (param.component === 'header') {
      if (param.format === 'location') {
        location = location || { latitude: '', longitude: '', name: '', address: '' }
        location[param.locationField] = value
      } else if (param.format === 'image') {
        headerMedia.push({ type: 'image', image: { link: value } })
      } else if (param.format === 'document') {
        headerMedia.push({
          type: 'document',
          document: { link: value, filename: filenameFromLink(value) },
        })
      } else {
        headerText.push(textParam(param, value))
      }
    }
  }
  const templateParams = []
  if (location) {
    templateParams.push({ type: 'header', parameters: [{ type: 'location', location }] })
  } else if (headerMedia.length) {
    templateParams.push({ type: 'header', parameters: headerMedia })
  } else if (headerText.length) {
    templateParams.push({ type: 'header', parameters: headerText })
  }
  if (body.length) templateParams.push({ type: 'body', parameters: body })
  for (const button of buttons.values()) {
    templateParams.push({
      type: 'button',
      sub_type: button.subType,
      index: button.index,
      parameters: button.parameters,
    })
  }
  return templateParams
}

export function campaignNameError(value) {
  const name = cleanValue(value)
  if (!name) return 'Dê um nome ao lote antes de disparar.'
  if (name.includes(':')) return 'O nome do lote não pode conter dois-pontos.'
  if (name.length > MAX_CAMPAIGN_NAME) return 'O nome do lote passa de 80 caracteres.'
  return ''
}

export function normalizeCampaignName(value) {
  return campaignNameError(value) ? '' : cleanValue(value)
}

export function dynamicVariables(columns, values) {
  const variables = {}
  for (const column of columns) {
    if (column.kind !== 'variable' && column.kind !== 'both') continue
    const value = cleanValue(values?.[column.key])
    if (value) variables[column.key] = value
  }
  return variables
}

export function outboundPayload({
  agentId,
  phoneNumberId,
  template,
  columns,
  values,
  whatsappUserId,
  campaignName,
}) {
  const payload = {
    whatsapp_phone_number_id: phoneNumberId,
    whatsapp_user_id: whatsappUserId,
    template_name: template.name,
    template_language_code: template.language,
    template_params: buildTemplateParams(template.parameters, values),
    agent_id: agentId,
  }
  const variables = dynamicVariables(columns, values)
  const campaign = normalizeCampaignName(campaignName)
  if (campaign) variables[BATCH_VARIABLE] = campaign
  if (Object.keys(variables).length) {
    payload.conversation_initiation_client_data = { dynamic_variables: variables }
  }
  return payload
}

export function readElevenError(body, fallback) {
  const clip = (value) => String(value).trim().slice(0, 280)
  if (!body || typeof body !== 'object') return fallback
  const detail = body.detail
  if (typeof detail === 'string' && detail.trim()) return clip(detail)
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    if (typeof detail.message === 'string' && detail.message.trim()) return clip(detail.message)
  }
  if (Array.isArray(detail)) {
    const text = detail
      .map((item) => (typeof item?.msg === 'string' ? item.msg : ''))
      .filter(Boolean)
      .join(' ')
    if (text) return clip(text)
  }
  if (typeof body.message === 'string' && body.message.trim()) return clip(body.message)
  return fallback
}

function agentName(agent) {
  const value = agent?.name
  return typeof value === 'string' ? value.trim() : ''
}

function usable(account) {
  return account.messagingEnabled && !account.tokenExpired
}

export async function loadSetup(agentId, fetchEleven) {
  const [agent, accounts] = await Promise.all([
    fetchEleven('GET', `/v1/convai/agents/${encodeURIComponent(agentId)}`),
    fetchEleven('GET', '/v1/convai/whatsapp-accounts'),
  ])
  if (!agent.ok) return { status: agent.status, payload: { error: agent.error } }
  if (!accounts.ok) return { status: accounts.status, payload: { error: accounts.error } }
  const items = Array.isArray(accounts.body?.items) ? accounts.body.items : []
  const shapedAccounts = (
    await Promise.all(
      items.map(async (item) => {
        const account = shapeAccount(item)
        if (!account) return null
        if (!usable(account)) {
          return {
            ...account,
            templates: [],
            templatesError: account.tokenExpired
              ? 'O token deste WhatsApp expirou. Reconecte a conta na ElevenLabs.'
              : 'O envio de mensagens está desligado neste número.',
          }
        }
        const templates = await fetchEleven(
          'GET',
          `/v1/convai/whatsapp-accounts/${account.phoneNumberId}/message-templates`,
        )
        if (!templates.ok) {
          return {
            ...account,
            templates: [],
            templatesError: 'Não foi possível listar os modelos deste número.',
          }
        }
        const list = (Array.isArray(templates.body?.items) ? templates.body.items : [])
          .map(shapeTemplate)
          .filter(Boolean)
          .sort((left, right) => left.name.localeCompare(right.name, 'pt'))
        return { ...account, templates: list, templatesError: '' }
      }),
    )
  ).filter(Boolean)
  const variables = collectVariables(agent.body)
  return {
    status: 200,
    payload: {
      id: agentId,
      name: agentName(agent.body),
      variables,
      columns: columnsFor(variables, null),
      accounts: shapedAccounts,
    },
  }
}

export async function assignNumber({ phoneNumberId, agentId }, fetchEleven) {
  const id = String(phoneNumberId ?? '')
  if (!PHONE_NUMBER_ID.test(id)) {
    return { status: 400, payload: { error: 'Número de WhatsApp inválido.' } }
  }
  const accounts = await fetchEleven('GET', '/v1/convai/whatsapp-accounts')
  if (!accounts.ok) return { status: accounts.status, payload: { error: accounts.error } }
  const account = (Array.isArray(accounts.body?.items) ? accounts.body.items : [])
    .map(shapeAccount)
    .find((item) => item?.phoneNumberId === id)
  if (!account) {
    return { status: 404, payload: { error: 'Esse número de WhatsApp não está nesta conta.' } }
  }
  const updated = await fetchEleven('PATCH', `/v1/convai/whatsapp-accounts/${id}`, {
    assigned_agent_id: agentId || null,
  })
  if (!updated.ok) return { status: updated.status, payload: { error: updated.error } }
  return {
    status: 200,
    payload: {
      phoneNumberId: id,
      assignedAgentId: agentId || '',
    },
  }
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function pauseAfterLimitMs(retryAfterMs) {
  const header = Number(retryAfterMs)
  const value = Number.isFinite(header) && header > 0 ? header : CLIENT_PAUSE_DEFAULT_MS
  return Math.min(Math.max(value, CLIENT_PAUSE_MIN_MS), CLIENT_PAUSE_MAX_MS)
}

function readRecipients(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'Nenhum destinatário no lote.' }
  }
  if (value.length > MAX_BATCH) {
    return { error: `Envie no máximo ${MAX_BATCH} contatos por lote.` }
  }
  const recipients = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: 'Há um destinatário inválido no lote.' }
    }
    const line = Number(item.line)
    if (!Number.isInteger(line) || line < 2 || line > 100000) {
      return { error: 'Há uma linha inválida no lote.' }
    }
    const values =
      item.values && typeof item.values === 'object' && !Array.isArray(item.values)
        ? item.values
        : {}
    recipients.push({ line, values })
  }
  return { recipients }
}

export async function sendBatch(input, fetchEleven, { sleep = defaultSleep } = {}) {
  const phoneNumberId = String(input?.phoneNumberId ?? '')
  const templateName = String(input?.templateName ?? '')
  const templateLanguage = String(input?.templateLanguage ?? '')
  if (!PHONE_NUMBER_ID.test(phoneNumberId)) {
    return { status: 400, payload: { error: 'Número de WhatsApp inválido.' } }
  }
  if (!TEMPLATE_NAME.test(templateName)) {
    return { status: 400, payload: { error: 'Modelo inválido.' } }
  }
  if (templateLanguage && !TEMPLATE_LANGUAGE.test(templateLanguage)) {
    return { status: 400, payload: { error: 'Idioma do modelo inválido.' } }
  }
  const parsed = readRecipients(input?.recipients)
  if (parsed.error) return { status: 400, payload: { error: parsed.error } }
  const campaignError = campaignNameError(input?.campaignName)
  if (campaignError) return { status: 400, payload: { error: campaignError } }

  const [agent, accounts, templates] = await Promise.all([
    fetchEleven('GET', `/v1/convai/agents/${encodeURIComponent(input.agentId)}`),
    fetchEleven('GET', '/v1/convai/whatsapp-accounts'),
    fetchEleven('GET', `/v1/convai/whatsapp-accounts/${phoneNumberId}/message-templates`),
  ])
  if (!agent.ok) return { status: agent.status, payload: { error: agent.error } }
  if (!accounts.ok) return { status: accounts.status, payload: { error: accounts.error } }
  if (!templates.ok) {
    return { status: templates.status, payload: { error: 'Não foi possível ler os modelos deste número.' } }
  }
  const account = (Array.isArray(accounts.body?.items) ? accounts.body.items : [])
    .map(shapeAccount)
    .find((item) => item?.phoneNumberId === phoneNumberId)
  if (!account) {
    return { status: 404, payload: { error: 'Esse número de WhatsApp não está nesta conta.' } }
  }
  if (account.tokenExpired) {
    return {
      status: 409,
      payload: { error: 'O token deste WhatsApp expirou. Reconecte a conta na ElevenLabs.' },
    }
  }
  if (!account.messagingEnabled) {
    return { status: 409, payload: { error: 'O envio de mensagens está desligado neste número.' } }
  }
  const matches = (Array.isArray(templates.body?.items) ? templates.body.items : []).filter(
    (item) => item?.name === templateName,
  )
  const raw = templateLanguage
    ? matches.find((item) => item.language === templateLanguage)
    : matches[0]
  if (!raw || (templateLanguage && raw.language !== templateLanguage)) {
    return { status: 404, payload: { error: 'Esse modelo não está disponível neste número.' } }
  }
  if (!templateLanguage && matches.length > 1) {
    return { status: 400, payload: { error: 'Há mais de um idioma para esse modelo.' } }
  }
  const template = shapeTemplate(raw)
  if (!template) {
    return { status: 409, payload: { error: 'Esse modelo ainda não está aprovado para envio.' } }
  }
  const columns = columnsFor(collectVariables(agent.body), template)
  const results = []
  let outboundPosts = 0
  const seenPhones = new Set()
  for (const recipient of parsed.recipients) {
    const planned = planRecipient(columns, recipient.values)
    if (!planned.ok) {
      results.push({ line: recipient.line, ok: false, error: planned.error })
      continue
    }
    if (seenPhones.has(planned.whatsappUserId)) {
      results.push({
        line: recipient.line,
        ok: false,
        error: 'Este número já entrou neste envio. A Meta limita mensagens repetidas para a mesma pessoa.',
      })
      continue
    }
    seenPhones.add(planned.whatsappUserId)
    if (outboundPosts > 0) await sleep(OUTBOUND_GAP_MS)
    const payload = outboundPayload({
      agentId: input.agentId,
      phoneNumberId,
      template,
      columns,
      values: planned.values,
      whatsappUserId: planned.whatsappUserId,
      campaignName: input.campaignName,
    })
    let sent = await postOutbound(fetchEleven, payload)
    if (sent.status === 429) {
      await sleep(RATE_RETRY_WAIT_MS)
      sent = await postOutbound(fetchEleven, payload)
    }
    outboundPosts += 1
    if (sent.status === 429) {
      return {
        status: 200,
        payload: {
          results,
          limited: true,
          retryAfterMs: pauseAfterLimitMs(sent.retryAfterMs),
        },
      }
    }
    if (!sent.ok) {
      results.push({
        line: recipient.line,
        ok: false,
        error: sent.error || 'A ElevenLabs recusou o disparo.',
      })
      continue
    }
    const conversationId = sent.body?.conversation_id
    if (typeof conversationId !== 'string' || !conversationId) {
      results.push({
        line: recipient.line,
        ok: false,
        error: 'A ElevenLabs não devolveu a conversa.',
      })
      continue
    }
    results.push({ line: recipient.line, ok: true, conversationId })
  }
  return { status: 200, payload: { results, limited: false, retryAfterMs: 0 } }
}

async function postOutbound(fetchEleven, payload) {
  try {
    return await fetchEleven('POST', '/v1/convai/whatsapp/outbound-message', payload)
  } catch {
    return { ok: false, status: 502, error: 'Não foi possível falar com a ElevenLabs.' }
  }
}
