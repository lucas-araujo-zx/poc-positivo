import { timingSafeEqual } from 'node:crypto'

const AGENT_ID = /^[a-zA-Z0-9_-]{8,128}$/
const CONVERSATION_ID = /^conv_[a-zA-Z0-9]+$/
const SKIP_VARIABLE = /^(system__|sip_)/i

export const WEBSITE_AGENT = {
  name: 'Consultor de Vendas (Web)',
  description:
    'Abre a loja para testar a Mia navegando o catálogo, filtrando e abrindo a ficha do produto.',
}

export function parseAgentIds(raw) {
  const text = String(raw ?? '')
    .trim()
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .trim()
  if (!text) {
    return []
  }

  const seen = new Set()
  const ids = []
  for (const piece of text.split(/[|,\n]/)) {
    const id = piece.trim()
    if (!AGENT_ID.test(id) || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function agentDisplayName(agent) {
  const value = agent?.name
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return ''
}

export function tokensMatch(given, expected) {
  const left = Buffer.from(String(given ?? ''))
  const right = Buffer.from(String(expected ?? ''))
  if (!right.length || left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

export function isAgentId(value) {
  return AGENT_ID.test(String(value ?? '').trim())
}

export function isConversationId(value) {
  return CONVERSATION_ID.test(String(value ?? '').trim())
}

export function readPlaceholders(agent) {
  const map =
    agent?.conversation_config?.agent?.dynamic_variables
      ?.dynamic_variable_placeholders
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return []
  }
  return Object.entries(map)
    .filter(([name]) => name && !SKIP_VARIABLE.test(name))
    .map(([name, placeholder]) => ({
      name,
      placeholder: placeholder == null ? '' : String(placeholder),
    }))
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value
}

function displayValue(value) {
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value)
}

export function shapeConversation(body) {
  const root = asRecord(body)
  const analysis = asRecord(root.analysis)
  const criteria = Object.entries(
    asRecord(analysis.evaluation_criteria_results),
  ).map(([id, item]) => {
    const record = asRecord(item)
    return {
      id: String(record.criteria_id || id),
      result: record.result ?? null,
      rationale: typeof record.rationale === 'string' ? record.rationale : '',
    }
  })
  const data = Object.entries(asRecord(analysis.data_collection_results)).map(
    ([key, item]) => {
      const record = asRecord(item)
      const value = record && 'value' in record ? record.value : item
      return {
        key,
        value: displayValue(value),
        rationale: typeof record.rationale === 'string' ? record.rationale : '',
      }
    },
  )
  const variables = Object.entries(
    asRecord(asRecord(root.conversation_initiation_client_data).dynamic_variables),
  )
    .filter(([key]) => !SKIP_VARIABLE.test(key))
    .map(([key, value]) => ({ key, value: displayValue(value) }))
  const transcript = Array.isArray(root.transcript)
    ? root.transcript
        .filter(
          (turn) =>
            turn &&
            (turn.role === 'user' || turn.role === 'agent') &&
            typeof turn.message === 'string' &&
            turn.message.trim(),
        )
        .map((turn) => ({ role: turn.role, message: turn.message.trim() }))
    : []
  const status = typeof root.status === 'string' ? root.status : ''
  const terminal = ['done', 'failed', 'completed'].includes(status.toLowerCase())
  const hasAnalysis =
    Boolean(typeof analysis.transcript_summary === 'string' && analysis.transcript_summary) ||
    criteria.length > 0 ||
    data.length > 0 ||
    analysis.call_successful != null
  return {
    agentId: typeof root.agent_id === 'string' ? root.agent_id : '',
    status,
    ready: status.toLowerCase() === 'failed' || (terminal && hasAnalysis),
    summary:
      typeof analysis.transcript_summary === 'string'
        ? analysis.transcript_summary
        : '',
    callSuccessful: analysis.call_successful ?? null,
    criteria,
    data,
    variables,
    transcript,
  }
}
