import { LabHeader } from './LabHeader.jsx'

function StorePreview() {
  return (
    <div className="store-stage" aria-hidden="true">
      <span className="store-bar" />
      <span className="store-hero" />
      <span className="store-tiles">
        <i />
        <i />
        <i />
      </span>
      <span className="store-orb" />
    </div>
  )
}

export function Picker({ agents, website, onOpen, onOpenStore, onSignOut }) {
  return (
    <div className="lab-app">
      <LabHeader onHome={() => onOpen('')} onSignOut={onSignOut} />
      <main className="picker">
        <header className="picker-head">
          <p className="kicker">Bancada</p>
          <h1>Qual agente você quer testar?</h1>
          <p>
            Os agentes do widget pedem as variáveis e devolvem o resultado da
            chamada. O consultor da loja abre o site neste mesmo endereço.
          </p>
        </header>
        <div className="agent-grid">
          <article className="agent-card is-store" style={{ '--i': 0 }}>
            <StorePreview />
            <p className="card-kicker">Fixo · Loja</p>
            <h2>{website.name}</h2>
            <p>{website.description}</p>
            <button type="button" className="cta" onClick={onOpenStore}>
              Abrir a loja
            </button>
          </article>
          {agents.map((agent, index) => (
            <article
              key={agent.id}
              className="agent-card"
              style={{ '--i': index + 1 }}
            >
              <p className="card-kicker">Widget · {String(index + 1).padStart(2, '0')}</p>
              <h2>{agent.name || 'Nome indisponível'}</h2>
              <p>
                {agent.error ||
                  'Preencha as variáveis, fale ou escreva, e veja o resultado quando a chamada terminar.'}
              </p>
              <button type="button" className="cta" onClick={() => onOpen(agent.id)}>
                Testar
              </button>
            </article>
          ))}
          {agents.length === 0 ? (
            <article className="agent-card is-empty" style={{ '--i': 1 }}>
              <p className="card-kicker">Widget</p>
              <h2>Nenhum agente cadastrado</h2>
              <p>
                Inclua os IDs em POSITIVO_AGENTS, separados por |. O nome
                aparece aqui depois da consulta à ElevenLabs.
              </p>
            </article>
          ) : null}
        </div>
      </main>
    </div>
  )
}
