import { useEffect, useState } from 'react'
import { agentSetup, conversation, signedUrl } from './api.js'
import { LabHeader } from './LabHeader.jsx'
import { Result } from './Result.jsx'
import { Widget } from './Widget.jsx'

function buildVariables(fields, values, extras) {
  const variables = {}
  for (const field of fields) {
    const value = (values[field.name] ?? '').trim()
    if (value) {
      variables[field.name] = value
    }
  }
  for (const extra of extras) {
    const name = extra.name.trim()
    const value = extra.value.trim()
    if (name && value) {
      variables[name] = value
    }
  }
  return variables
}

export function Session({ token, agent, onBack, onSignOut }) {
  const [title, setTitle] = useState(agent.name)
  const [fields, setFields] = useState([])
  const [values, setValues] = useState({})
  const [extras, setExtras] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [signed, setSigned] = useState('')
  const [variables, setVariables] = useState({})
  const [conversationId, setConversationId] = useState('')
  const [phase, setPhase] = useState('idle')
  const [record, setRecord] = useState(null)
  const [resultError, setResultError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    agentSetup(token, agent.id)
      .then((setup) => {
        if (cancelled) {
          return
        }
        setTitle(setup.name || agent.name)
        setFields(setup.variables)
        setValues(
          Object.fromEntries(setup.variables.map((field) => [field.name, ''])),
        )
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, agent.id, agent.name])

  useEffect(() => {
    if (!conversationId) {
      return undefined
    }
    let cancelled = false
    let attempts = 0
    let timer = 0

    async function poll() {
      attempts += 1
      try {
        const next = await conversation(token, agent.id, conversationId)
        if (cancelled) {
          return
        }
        setRecord(next)
        if (next.ready) {
          setPhase('done')
          return
        }
        if (attempts >= 20) {
          setPhase('partial')
          return
        }
        setPhase('waiting')
        timer = window.setTimeout(poll, 2000)
      } catch (error) {
        if (!cancelled) {
          setPhase('error')
          setResultError(error.message)
        }
      }
    }

    setPhase('waiting')
    setRecord(null)
    setResultError('')
    poll()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [conversationId, token, agent.id])

  async function openConversation() {
    setStarting(true)
    setStartError('')
    setConversationId('')
    setRecord(null)
    setPhase('idle')
    try {
      const session = await signedUrl(token, agent.id)
      setVariables(buildVariables(fields, values, extras))
      setSigned(session.signedUrl)
    } catch (error) {
      setStartError(error.message)
    } finally {
      setStarting(false)
    }
  }

  function addExtra() {
    setExtras((current) => [
      ...current,
      { id: crypto.randomUUID(), name: '', value: '' },
    ])
  }

  return (
    <div className="lab-app">
      <LabHeader onHome={onBack} onSignOut={onSignOut} />
      <main className="session">
        <button type="button" className="back" onClick={onBack}>
          Agentes
        </button>
        <header className="session-head">
          <p className="kicker">Widget</p>
          <h1>{title || 'Agente'}</h1>
          <p>
            Preencha o que a conversa precisa saber. O widget abre em seguida,
            por voz ou por texto. O resultado aparece aqui quando a chamada
            termina.
          </p>
        </header>

        {loading ? <p className="result-wait">Carregando as variáveis...</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}

        {!loading && !loadError ? (
          <form
            className="var-form"
            onSubmit={(event) => {
              event.preventDefault()
              openConversation()
            }}
          >
            {fields.length === 0 ? (
              <p className="result-wait">
                Este agente não declara variáveis. Você pode incluir alguma ou
                abrir a conversa direto.
              </p>
            ) : (
              fields.map((field) => (
                <label key={field.name} className="field">
                  <span>{field.name.replaceAll('_', ' ')}</span>
                  <input
                    value={values[field.name] ?? ''}
                    placeholder={field.placeholder || 'Valor da variável'}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))
            )}

            {extras.map((extra) => (
              <div key={extra.id} className="extra-row">
                <label className="field">
                  <span>Nome</span>
                  <input
                    value={extra.name}
                    onChange={(event) =>
                      setExtras((current) =>
                        current.map((item) =>
                          item.id === extra.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Valor</span>
                  <input
                    value={extra.value}
                    onChange={(event) =>
                      setExtras((current) =>
                        current.map((item) =>
                          item.id === extra.id
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}

            <div className="form-actions">
              <button type="button" className="ghost" onClick={addExtra}>
                Adicionar variável
              </button>
              <button type="submit" className="cta" disabled={starting}>
                {starting ? 'Conectando...' : signed ? 'Nova conversa' : 'Abrir conversa'}
              </button>
            </div>
            {startError ? <p className="form-error">{startError}</p> : null}
            {signed ? (
              <p className="result-wait">
                O assistente está no canto da tela. Fale ou escreva. Ao
                encerrar, o resultado entra abaixo.
              </p>
            ) : null}
          </form>
        ) : null}

        <Result phase={phase} record={record} error={resultError} />
      </main>
      {signed ? (
        <Widget
          signedUrl={signed}
          variables={variables}
          onEnded={setConversationId}
        />
      ) : null}
    </div>
  )
}
