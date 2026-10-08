import { useEffect, useRef } from 'react'

function outcome(value) {
  const text = String(value ?? '').toLowerCase()
  if (value === true || text === 'success' || text === 'true') {
    return { label: 'Sim', tone: 'is-yes' }
  }
  if (value === false || text === 'failure' || text === 'false') {
    return { label: 'Não', tone: 'is-no' }
  }
  return { label: '—', tone: 'is-unknown' }
}

function statusLabel(status) {
  const labels = {
    initiated: 'Iniciada',
    'in-progress': 'Em andamento',
    processing: 'Processando',
    done: 'Concluída',
    completed: 'Concluída',
    failed: 'Falhou',
  }
  return labels[status?.toLowerCase()] || status || 'Aguardando'
}

function Fields({ items }) {
  if (!items.length) {
    return null
  }
  return (
    <dl className="result-fields">
      {items.map((item) => (
        <div key={item.key}>
          <dt>{item.key.replaceAll('_', ' ')}</dt>
          <dd>{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Result({ phase, record, error }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (phase === 'idle') {
      return
    }
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phase, record, error])

  if (phase === 'idle') {
    return null
  }

  const waiting = phase === 'waiting'
  const call = record ? outcome(record.callSuccessful) : null

  return (
    <section ref={panelRef} className="result" aria-live="polite">
      <header className="result-head">
        <p className="kicker">Resultado</p>
        <div>
          <h2>
            {waiting
              ? 'Lendo a chamada'
              : phase === 'error'
                ? 'Não foi possível ler o resultado'
                : 'Conversa encerrada'}
          </h2>
          {record?.status ? <span>{statusLabel(record.status)}</span> : null}
        </div>
      </header>

      {waiting ? (
        <p className="result-wait">A análise chega alguns segundos depois do encerramento.</p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {phase === 'partial' ? (
        <p className="result-wait">A análise ainda não chegou. O que já temos está abaixo.</p>
      ) : null}

      {record && phase !== 'waiting' ? (
        <div className="result-groups">
          {record.summary ? (
            <section>
              <h3>Resumo</h3>
              <p>{record.summary}</p>
            </section>
          ) : null}
          {call && call.label !== '—' ? (
            <section>
              <h3>Chamada bem-sucedida</h3>
              <span className={`flag ${call.tone}`}>{call.label}</span>
            </section>
          ) : null}
          {record.criteria.length > 0 ? (
            <section>
              <h3>Critérios</h3>
              <div className="criteria">
                {record.criteria.map((item) => {
                  const mark = outcome(item.result)
                  return (
                    <article key={item.id}>
                      <div>
                        <h4>{item.id.replaceAll('_', ' ')}</h4>
                        <span className={`flag ${mark.tone}`}>{mark.label}</span>
                      </div>
                      {item.rationale ? <p>{item.rationale}</p> : null}
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}
          {record.data.length > 0 ? (
            <section>
              <h3>Dados coletados</h3>
              <Fields items={record.data} />
            </section>
          ) : null}
          {record.variables.length > 0 ? (
            <section>
              <h3>Variáveis</h3>
              <Fields items={record.variables} />
            </section>
          ) : null}
          {record.transcript.length > 0 ? (
            <section>
              <h3>Transcrição</h3>
              <ol className="transcript">
                {record.transcript.map((turn, index) => (
                  <li key={`${turn.role}-${index}`} className={turn.role}>
                    <span>{turn.role === 'user' ? 'Você' : 'Agente'}</span>
                    <p>{turn.message}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
