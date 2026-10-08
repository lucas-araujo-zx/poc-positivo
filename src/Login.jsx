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
      <header className="login-top">
        <img src={LOGO} alt="Positivo Empresas" />
        <p>Laboratório de agentes</p>
      </header>
      <section className="login-stage">
        <div className="login-copy">
          <h1>
            <span>Teste os agentes da Positivo.</span>
          </h1>
          <p>
            Um token abre a bancada. Depois você escolhe o assistente e
            conversa por voz ou por texto.
          </p>
        </div>
        <div className="login-shell">
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
              <span>{loading ? 'Verificando...' : 'Entrar'}</span>
              <i aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8.5 3.5 12 7 8.5 10.5" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </i>
            </button>
            {message ? (
              <p className="form-error" role="alert">
                {message}
              </p>
            ) : null}
          </form>
        </div>
      </section>
      <footer className="login-mark" aria-hidden="true">
        <p>Positivo</p>
      </footer>
    </div>
  )
}
