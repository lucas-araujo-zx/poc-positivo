import { useEffect, useState } from 'react'

const LOGO =
  'https://static.meupositivo.com.br/images/b2b/logo-positivo-empresas.png'

export function Login({ error, loading, onSubmit }) {
  const [token, setToken] = useState('')
  const [localError, setLocalError] = useState('')
  const [unlockField, setUnlockField] = useState(false)

  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  function handleSubmit(event) {
    event.preventDefault()
    const next = token.trim()
    if (!next) {
      setLocalError('Cole o token de acesso.')
      return
    }
    setLocalError('')
    onSubmit(next)
  }

  const message = localError || error

  return (
    <div className="login-page">
      <a className="skip-link" href="#entrar">
        Ir para o acesso
      </a>
      <div className="login-stage" aria-hidden="true">
        <p className="watermark">Positivo</p>
        <span className="scanline" />
        <span className="beam" />
      </div>
      <section className="login-layout">
        <div className="login-copy">
          <img src={LOGO} alt="Positivo Empresas" />
          <p className="kicker">Laboratório</p>
          <h1>Teste os agentes da Positivo.</h1>
          <span className="rule" />
          <p>
            Um token abre a bancada. Depois você escolhe o assistente e
            conversa por voz ou por texto.
          </p>
        </div>
        <form id="entrar" className="login-panel" autoComplete="off" onSubmit={handleSubmit}>
          <div className="login-autofill-trap" aria-hidden="true">
            <input type="text" tabIndex={-1} autoComplete="username" />
          </div>
          <label className="field">
            <span>Token de acesso</span>
            <input
              type="password"
              name="ex_access"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Cole o token recebido"
              value={token}
              readOnly={!unlockField}
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              onFocus={() => setUnlockField(true)}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <button type="submit" className="cta" disabled={loading}>
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
          {message ? (
            <p className="form-error" role="alert">
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  )
}
