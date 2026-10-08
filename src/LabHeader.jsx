const LOGO =
  'https://static.meupositivo.com.br/images/b2b/logo-positivo-empresas.png'

export function LabHeader({ onHome, onSignOut }) {
  return (
    <header className="lab-header">
      <button type="button" className="logo-button" onClick={onHome}>
        <img src={LOGO} alt="Positivo Empresas" />
      </button>
      <p>Laboratório de agentes</p>
      <button type="button" className="text-button" onClick={onSignOut}>
        Sair
      </button>
    </header>
  )
}
