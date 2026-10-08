import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agentDisplayName,
  parseAgentIds,
  readPlaceholders,
  shapeConversation,
  tokensMatch,
} from './agents.js'

test('parseAgentIds reads only ids separated by pipe, comma or line', () => {
  assert.deepEqual(
    parseAgentIds('{agent_abc12345|agent_def67890,agent_zzzzzzzz\nagent_qqqqqqqq}'),
    ['agent_abc12345', 'agent_def67890', 'agent_zzzzzzzz', 'agent_qqqqqqqq'],
  )
})

test('parseAgentIds skips names, short tokens and duplicate ids', () => {
  assert.deepEqual(
    parseAgentIds('Pesquisa de satisfação|agent_abc12345|abc|agent_abc12345'),
    ['agent_abc12345'],
  )
})

test('agentDisplayName reads the name returned by ElevenLabs', () => {
  assert.equal(
    agentDisplayName({ name: ' Positivo - Pesquisa de Satisfação ' }),
    'Positivo - Pesquisa de Satisfação',
  )
  assert.equal(agentDisplayName({}), '')
})

test('tokensMatch compares equal secrets and rejects a different length', () => {
  assert.equal(tokensMatch('segredo-local', 'segredo-local'), true)
  assert.equal(tokensMatch('segredo-local', 'segredo-outra'), false)
  assert.equal(tokensMatch('curto', 'segredo-local'), false)
  assert.equal(tokensMatch('segredo-local', ''), false)
})

test('readPlaceholders keeps declared variables and drops system keys', () => {
  const fields = readPlaceholders({
    conversation_config: {
      agent: {
        dynamic_variables: {
          dynamic_variable_placeholders: {
            nome_cliente: 'Ana',
            system__agent_id: 'agent_x',
          },
        },
      },
    },
  })
  assert.deepEqual(fields, [{ name: 'nome_cliente', placeholder: 'Ana' }])
})

test('shapeConversation waits for analysis and then exposes the result groups', () => {
  const pending = shapeConversation({
    agent_id: 'agent_abc12345',
    status: 'processing',
    transcript: [{ role: 'agent', message: 'Oi' }],
  })
  assert.equal(pending.ready, false)

  const ready = shapeConversation({
    agent_id: 'agent_abc12345',
    status: 'done',
    analysis: {
      transcript_summary: 'A cliente pediu um notebook.',
      call_successful: 'success',
      evaluation_criteria_results: {
        entendeu_pedido: { result: 'success', rationale: 'Filtrou o catálogo.' },
      },
      data_collection_results: {
        interesse: { value: 'notebook', rationale: '' },
      },
    },
    conversation_initiation_client_data: {
      dynamic_variables: { nome_cliente: 'Ana', system__conversation_id: 'conv_1' },
    },
    transcript: [
      { role: 'user', message: 'Quero um notebook.' },
      { role: 'agent', message: 'Vou olhar o catálogo.' },
    ],
  })
  assert.equal(ready.ready, true)
  assert.equal(ready.summary, 'A cliente pediu um notebook.')
  assert.equal(ready.criteria[0].id, 'entendeu_pedido')
  assert.equal(ready.data[0].value, 'notebook')
  assert.deepEqual(ready.variables, [{ key: 'nome_cliente', value: 'Ana' }])
  assert.equal(ready.transcript.length, 2)
})
