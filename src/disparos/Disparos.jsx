import { useEffect, useMemo, useRef, useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { whatsappAssign, whatsappDispatch, whatsappSetup } from '../api.js'
import { LabHeader } from '../LabHeader.jsx'
import {
  campaignNameError,
  cellToString,
  columnsFor,
  escapeCsv,
  mapSheet,
  MAX_BATCH,
  parseCsv,
  sampleCsv,
} from '../../server/whatsapp.js'

const CATEGORY = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
}

const KIND = {
  phone: 'Telefone',
  variable: 'Variável do agente',
  template: 'Parâmetro do modelo',
  both: 'Variável e modelo',
}

function templateKey(template) {
  return `${template.name}:${template.language}`
}

function languageLabel(code) {
  if (code === 'pt_BR') return 'Português (Brasil)'
  if (code === 'pt_PT') return 'Português (Portugal)'
  if (code === 'en' || code === 'en_US') return 'Inglês'
  return code
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function resultsCsv(rows, report) {
  const lines = ['linha;telefone;situacao;conversa;erro']
  for (const row of rows) {
    const result = report.find((item) => item.line === row.line)
    const status = result
      ? result.ok
        ? 'aceita'
        : 'falhou'
      : row.ok
        ? 'nao_enviada'
        : 'invalida'
    lines.push(
      [row.line, row.whatsappUserId, status, result?.conversationId || '', result?.error || row.error || '']
        .map(escapeCsv)
        .join(';'),
    )
  }
  return `\uFEFF${lines.join('\n')}\n`
}

function preferredAccount(accounts, agentId) {
  const usable = (account) => account.messagingEnabled && !account.tokenExpired
  return (
    accounts.find((account) => account.assignedAgentId === agentId && usable(account)) ||
    accounts.find(usable) ||
    accounts[0] ||
    null
  )
}

export function Disparos({ token, agents, onBack, onSignOut }) {
  const inputRef = useRef(null)
  const [agentId, setAgentId] = useState('')
  const [setup, setSetup] = useState(null)
  const [setupError, setSetupError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phoneId, setPhoneId] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [sheet, setSheet] = useState(null)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState('')
  const [fileWarning, setFileWarning] = useState('')
  const [over, setOver] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [dispatchNote, setDispatchNote] = useState('')
  const [report, setReport] = useState([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [assigning, setAssigning] = useState('')
  const [assignError, setAssignError] = useState('')
  const [assignNotice, setAssignNotice] = useState('')

  useEffect(() => {
    if (!agentId) {
      setSetup(null)
      setSetupError('')
      setPhoneId('')
      setSelectedTemplate('')
      setSheet(null)
      setReport([])
      setAssignError('')
      setAssignNotice('')
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setSetupError('')
    setSetup(null)
    setPhoneId('')
    setSelectedTemplate('')
    setSheet(null)
    setFileError('')
    setFileWarning('')
    setReport([])
    setSendError('')
    setAssignError('')
    setAssignNotice('')
    setAssigning('')
    whatsappSetup(token, agentId)
      .then((data) => {
        if (cancelled) return
        setSetup(data)
        setPhoneId(preferredAccount(data.accounts || [], data.id)?.phoneNumberId || '')
      })
      .catch((error) => {
        if (!cancelled) setSetupError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agentId, token])

  const account = setup?.accounts?.find((item) => item.phoneNumberId === phoneId) ?? null
  const template =
    account?.templates?.find((item) => templateKey(item) === selectedTemplate) ?? null
  const columns = useMemo(
    () => (setup ? columnsFor(setup.variables, template) : []),
    [setup, template],
  )
  const mapped = useMemo(() => {
    if (!sheet || !columns.length) return null
    return mapSheet(sheet.headers, sheet.rows, columns)
  }, [sheet, columns])

  const ready = mapped?.rows?.filter((row) => row.ok) ?? []
  const invalid = mapped?.rows?.filter((row) => !row.ok) ?? []
  const accepted = new Set(report.filter((item) => item.ok).map((item) => item.line))
  const pending = ready.filter((row) => !accepted.has(row.line))
  const campaignError = campaignNameError(campaignName)
  const canSend =
    Boolean(template && account?.messagingEnabled && !account.tokenExpired) &&
    !campaignError &&
    !mapped?.error &&
    !mapped?.missingColumns?.length &&
    pending.length > 0 &&
    !sending

  async function changeAssignment(targetId, nextAgentId) {
    setAssigning(`${targetId}:${nextAgentId ? 'link' : 'unlink'}`)
    setAssignError('')
    setAssignNotice('')
    try {
      await whatsappAssign(token, { phoneNumberId: targetId, agentId: nextAgentId })
    } catch (error) {
      setAssignError(error.message)
      setAssigning('')
      return
    }
    try {
      const data = await whatsappSetup(token, agentId)
      setSetup(data)
      if (nextAgentId) setPhoneId(targetId)
      setAssignNotice(
        nextAgentId
          ? 'Número vinculado a este agente. Quem responder passa a cair aqui.'
          : 'Número removido deste agente.',
      )
    } catch (error) {
      setAssignError(`${error.message} O vínculo pode já ter sido salvo; recarregue a página.`)
    } finally {
      setAssigning('')
    }
  }

  async function readFile(file) {
    setFileError('')
    setFileWarning('')
    setReport([])
    setSendError('')
    const name = file.name.toLowerCase()
    if (file.size > 5 * 1024 * 1024) {
      setSheet(null)
      setFileError('O arquivo passa de 5 MB.')
      return
    }
    if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
      setSheet(null)
      setFileError('Salve a planilha como .xlsx. O formato .xls não entra neste disparo.')
      return
    }
    try {
      if (name.endsWith('.xlsx')) {
        const matrix = await readSheet(file)
        const table = matrix.map((row) =>
          (Array.isArray(row) ? row : []).map((cell) => cellToString(cell)),
        )
        setFileName(file.name)
        setSheet({ headers: table[0] || [], rows: table.slice(1) })
        return
      }
      if (name.endsWith('.csv') || file.type.includes('csv') || file.type.startsWith('text/')) {
        const parsed = parseCsv(await file.text())
        if (parsed.error) {
          setSheet(null)
          setFileError(parsed.error)
          return
        }
        setFileName(file.name)
        setFileWarning(parsed.warning || '')
        setSheet({ headers: parsed.headers, rows: parsed.rows })
        return
      }
      setSheet(null)
      setFileError('Envie um arquivo .csv ou .xlsx.')
    } catch {
      setSheet(null)
      setFileError('Não consegui ler este arquivo. Salve como .xlsx ou CSV em UTF-8.')
    }
  }

  async function dispatch() {
    if (!canSend) return
    let queue = pending.slice()
    setSending(true)
    setSendError('')
    setDispatchNote('')
    setProgress({ done: accepted.size, total: ready.length })
    const results = report.filter((item) => accepted.has(item.line))
    let pauses = 0
    try {
      let cursor = 0
      while (cursor < queue.length) {
        const chunk = queue.slice(cursor, cursor + MAX_BATCH)
        let response
        try {
          response = await whatsappDispatch(token, {
            agentId: setup.id,
            phoneNumberId: account.phoneNumberId,
            templateName: template.name,
            templateLanguage: template.language,
            campaignName,
            recipients: chunk.map((row) => ({ line: row.line, values: row.values })),
          })
        } catch (error) {
          if (/limitou/i.test(error.message) && pauses < 4) {
            pauses += 1
            const seconds = 8
            setDispatchNote(`A API pediu uma pausa de ${seconds}s. O envio continua em seguida.`)
            await wait(seconds * 1000)
            continue
          }
          for (const row of chunk) {
            results.push({ line: row.line, ok: false, error: error.message })
          }
          setSendError(error.message)
          break
        }
        if (!Array.isArray(response?.results)) {
          throw new Error('A API não devolveu o resultado do lote.')
        }
        results.push(...response.results)
        setReport([...results])
        setProgress({ done: results.length, total: ready.length })
        if (response.limited) {
          pauses += 1
          const returned = new Set(response.results.map((item) => item.line))
          const still = chunk.filter((row) => !returned.has(row.line))
          queue = [...queue.slice(0, cursor), ...still, ...queue.slice(cursor + chunk.length)]
          if (pauses > 4) {
            setDispatchNote('')
            setSendError('A ElevenLabs limitou os envios. Espere um pouco e use Repetir para continuar.')
            break
          }
          const seconds = Math.max(2, Math.round((Number(response.retryAfterMs) || 8000) / 1000))
          setDispatchNote(`A API pediu uma pausa de ${seconds}s. O envio continua em seguida.`)
          await wait(Math.min(Number(response.retryAfterMs) || 8000, 20000))
          continue
        }
        setDispatchNote('')
        cursor += chunk.length
      }
    } catch (error) {
      setSendError(error.message)
    } finally {
      setReport([...results])
      setDispatchNote('')
      setSending(false)
    }
  }

  const preview = (mapped?.rows || []).slice(0, 6)
  const acceptedCount = report.filter((item) => item.ok).length
  const failedCount = report.filter((item) => !item.ok).length

  return (
    <div className="lab-app">
      <LabHeader onHome={onBack} onSignOut={onSignOut} />
      <main className="session disparos">
        <button type="button" className="back" onClick={onBack}>
          Agentes
        </button>
        <header className="session-head">
          <p className="kicker">WhatsApp</p>
          <h1>Mensagem ativa</h1>
          <p>
            Escolha o agente, o modelo aprovado e uma planilha. Cada linha vira
            um disparo. O modelo é a mensagem que chega; as variáveis do agente
            entram na conversa quando a pessoa responde.
          </p>
        </header>

        <h2>Agente</h2>
        <label className="field">
          <span>Agente do workspace</span>
          <select
            value={agentId}
            disabled={sending}
            onChange={(event) => setAgentId(event.target.value)}
          >
            <option value="">Selecione</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id} disabled={Boolean(agent.error)}>
                {agent.name || agent.id}
                {agent.error ? ' — indisponível' : ''}
              </option>
            ))}
          </select>
        </label>
        {agents.length === 0 ? (
          <p className="note">Nenhum agente em POSITIVO_AGENTS.</p>
        ) : null}
        {loading ? <p className="result-wait">Lendo variáveis e modelos…</p> : null}
        {setupError ? <p className="form-error">{setupError}</p> : null}

        {setup && !loading ? (
          <>
            <h2>Colunas da planilha</h2>
            <p className="lead">
              O telefone é obrigatório no arquivo de{' '}
              <strong>{setup.name || 'este agente'}</strong>. As variáveis do
              agente podem ficar em branco. O telefone aceita os nomes telefone,
              celular e whatsapp.
            </p>
            <div className="sheet-scroll">
              <table className="column-table">
                <thead>
                  <tr>
                    <th>Coluna</th>
                    <th>Uso</th>
                    <th>O que preencher</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((column) => (
                    <tr key={column.key}>
                      <td>{column.key}</td>
                      <td>
                        {KIND[column.kind] || column.kind}
                        {column.required ? '' : ' · opcional'}
                      </td>
                      <td>{column.hint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              {template
                ? template.parameters.length
                  ? `Este modelo também pede ${template.parameters.map((item) => item.key).join(', ')}.`
                  : 'Este modelo não tem parâmetros. Todas as linhas recebem o mesmo texto.'
                : 'Escolha o modelo abaixo. Se ele tiver parâmetros, as colunas entram nesta tabela.'}
            </p>
            <div className="form-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="ghost"
                onClick={() => download('modelo-disparo.csv', sampleCsv(columns))}
              >
                Baixar cabeçalho CSV
              </button>
            </div>

            <h2>Número do WhatsApp</h2>
            <p className="lead">
              Estes são os números da conta. Vincule um deles a este agente, ou
              remova. O mesmo número pode passar de um agente para outro.
            </p>
            {!setup.accounts?.length ? (
              <p className="form-error">
                Nenhum WhatsApp está conectado nesta conta da ElevenLabs.
              </p>
            ) : (
              <>
                <ul className="number-list">
                  {setup.accounts.map((item) => {
                    const onThisAgent = item.assignedAgentId === setup.id
                    const selected = item.phoneNumberId === phoneId
                    const pending = assigning.startsWith(`${item.phoneNumberId}:`)
                    let action = 'Vincular a este agente'
                    if (pending) action = onThisAgent ? 'Removendo…' : 'Vinculando…'
                    else if (onThisAgent) action = 'Remover deste agente'
                    else if (item.assignedAgentName) action = `Tirar de ${item.assignedAgentName} e usar aqui`
                    return (
                      <li
                        key={item.phoneNumberId}
                        className={selected ? 'number-card is-selected' : 'number-card'}
                      >
                        <button
                          type="button"
                          className="number-pick"
                          disabled={sending || Boolean(assigning)}
                          onClick={() => {
                            setPhoneId(item.phoneNumberId)
                            setSelectedTemplate('')
                            setReport([])
                          }}
                        >
                          <strong>{item.phoneNumberName || item.businessAccountName}</strong>
                          <span>{item.phoneNumber}</span>
                          <span>
                            {onThisAgent
                              ? 'Vinculado a este agente'
                              : item.assignedAgentName
                                ? `Vinculado a ${item.assignedAgentName}`
                                : 'Sem agente'}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={onThisAgent ? 'ghost' : 'cta'}
                          disabled={sending || Boolean(assigning)}
                          onClick={() =>
                            void changeAssignment(item.phoneNumberId, onThisAgent ? null : setup.id)
                          }
                        >
                          {action}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {assignNotice ? <p className="note">{assignNotice}</p> : null}
                {assignError ? <p className="form-error">{assignError}</p> : null}
                <h2>Modelo</h2>
                {account?.templatesError ? <p className="form-error">{account.templatesError}</p> : null}
                {account && !account.templatesError && account.templates.length === 0 ? (
                  <p className="form-error">Nenhum modelo aprovado neste número.</p>
                ) : null}
                <div className="template-grid" style={{ marginTop: 14 }}>
                  {(account?.templates || []).map((item) => {
                    const selected = templateKey(item) === selectedTemplate
                    return (
                      <button
                        key={templateKey(item)}
                        type="button"
                        className={selected ? 'template-card is-selected' : 'template-card'}
                        aria-pressed={selected}
                        disabled={sending}
                        onClick={() => {
                          setSelectedTemplate(templateKey(item))
                          setReport([])
                          setSendError('')
                        }}
                      >
                        <span className="card-kicker">
                          {CATEGORY[item.category] || item.category || 'Modelo'}
                          {' · '}
                          {languageLabel(item.language)}
                        </span>
                        <h3>{item.name}</h3>
                        {item.header ? <span className="template-header">{item.header}</span> : null}
                        <p className="template-body">{item.body || 'Sem texto no corpo.'}</p>
                        {item.footer ? <span className="template-footer">{item.footer}</span> : null}
                        <span className="template-meta">
                          {item.parameters.length
                            ? `Parâmetros: ${item.parameters.map((param) => param.key).join(', ')}`
                            : 'Sem parâmetros'}
                          {item.requestsCallPermission ? ' · Pede permissão de ligação' : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {template ? (
              <>
                <h2>Planilha</h2>
                <p className="lead">
                  CSV em UTF-8, com vírgula ou ponto e vírgula, ou uma planilha
                  .xlsx. Até 2000 linhas. No Excel, formate o telefone como texto.
                </p>
                <div
                  className={over ? 'dropzone is-over' : 'dropzone'}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setOver(true)
                  }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setOver(false)
                    const file = event.dataTransfer.files?.[0]
                    if (file && !sending) void readFile(file)
                  }}
                >
                  <strong>{fileName || 'Solte o arquivo aqui'}</strong>
                  <p>ou escolha no computador</p>
                  <button
                    type="button"
                    className="ghost"
                    disabled={sending}
                    onClick={() => inputRef.current?.click()}
                  >
                    Selecionar arquivo
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    hidden
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) void readFile(file)
                    }}
                  />
                </div>
                {fileError ? <p className="form-error">{fileError}</p> : null}
                {fileWarning ? <p className="note">{fileWarning}</p> : null}

                {mapped?.error ? <p className="form-error">{mapped.error}</p> : null}
                {mapped && !mapped.error && mapped.missingColumns.length ? (
                  <p className="form-error">
                    Faltam colunas: {mapped.missingColumns.join(', ')}.
                  </p>
                ) : null}
                {mapped && !mapped.error && !mapped.missingColumns.length ? (
                  <p className="note">
                    {invalid.length
                      ? `${ready.length} ${ready.length === 1 ? 'linha pronta' : 'linhas prontas'} · ${invalid.length} com erro, fora do disparo.`
                      : `${ready.length} ${ready.length === 1 ? 'linha pronta' : 'linhas prontas'}.`}
                  </p>
                ) : null}
                {mapped?.unknown?.length ? (
                  <p className="note">
                    Estas colunas não entram no disparo: {mapped.unknown.join(', ')}.
                  </p>
                ) : null}
                {mapped?.duplicates?.length ? (
                  <p className="note">
                    Há números repetidos nas linhas{' '}
                    {mapped.duplicates.map((item) => item.lines.join(' e ')).join(', ')}.
                    Só a primeira linha de cada número entra no disparo.
                  </p>
                ) : null}

                {preview.length ? (
                  <div className="sheet-scroll" style={{ marginTop: 12 }}>
                    <table className="result-table">
                      <thead>
                        <tr>
                          <th>Linha</th>
                          <th>Telefone</th>
                          {columns
                            .filter((column) => column.key !== 'whatsapp_user_id')
                            .map((column) => (
                              <th key={column.key}>{column.key}</th>
                            ))}
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row) => (
                          <tr key={row.line}>
                            <td>{row.line}</td>
                            <td>{row.whatsappUserId || row.values.whatsapp_user_id || '—'}</td>
                            {columns
                              .filter((column) => column.key !== 'whatsapp_user_id')
                              .map((column) => (
                                <td key={column.key}>{row.values[column.key] || '—'}</td>
                              ))}
                            <td className={row.ok ? 'row-ok' : 'row-bad'}>
                              {row.ok ? 'Pronta' : row.error}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {mapped?.rows?.length > preview.length ? (
                  <p className="note">Mostrando {preview.length} de {mapped.rows.length} linhas.</p>
                ) : null}

                <label className="field" style={{ marginTop: 18, maxWidth: 480 }}>
                  <span>Nome do lote</span>
                  <input
                    value={campaignName}
                    disabled={sending}
                    maxLength={80}
                    placeholder="carrinho-2026-10-29"
                    onChange={(event) => setCampaignName(event.target.value)}
                  />
                </label>
                {campaignName && campaignError ? <p className="form-error">{campaignError}</p> : null}
                <p className="note">
                  Esse nome marca cada conversa deste disparo. Não entra no texto enviado no WhatsApp.
                </p>
                <div className="form-actions" style={{ marginTop: 18 }}>
                  <button type="button" className="cta" disabled={!canSend} onClick={() => void dispatch()}>
                    {sending
                      ? `Enviando ${progress.done} de ${progress.total}`
                      : !sheet
                        ? 'Envie a planilha'
                        : mapped?.missingColumns?.length
                          ? 'Faltam colunas'
                          : campaignError
                            ? 'Dê um nome ao lote'
                            : report.length && pending.length
                              ? `Repetir ${pending.length} ${pending.length === 1 ? 'linha' : 'linhas'}`
                              : `Disparar ${pending.length} ${pending.length === 1 ? 'mensagem' : 'mensagens'}`}
                  </button>
                </div>
                <p className="note" aria-live="polite">
                  {dispatchNote ||
                    'Cada mensagem sai sozinha, com uma pausa entre os envios. Se a API limitar, o disparo espera e continua. Uma resposta aceita significa que a ElevenLabs recebeu o pedido; a entrega ainda depende da Meta.'}
                </p>
                {sendError ? <p className="form-error">{sendError}</p> : null}

                {report.length ? (
                  <>
                    <h2>Resultado</h2>
                    <p className="lead">
                      {acceptedCount} aceitas pela ElevenLabs
                      {failedCount ? ` · ${failedCount} falharam` : ''}.
                    </p>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          download(
                            'resultado-disparo.csv',
                            resultsCsv(mapped?.rows || [], report),
                          )
                        }
                      >
                        Baixar resultado
                      </button>
                    </div>
                    <div className="sheet-scroll" style={{ marginTop: 12 }}>
                      <table className="result-table">
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>Telefone</th>
                            <th>Situação</th>
                            <th>Conversa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.map((item) => {
                            const row = mapped?.rows?.find((entry) => entry.line === item.line)
                            return (
                              <tr key={item.line}>
                                <td>{item.line}</td>
                                <td>{row?.whatsappUserId || '—'}</td>
                                <td className={item.ok ? 'row-ok' : 'row-bad'}>
                                  {item.ok ? 'Aceita' : item.error}
                                </td>
                                <td>{item.conversationId ? <code>{item.conversationId}</code> : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  )
}
