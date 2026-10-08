import { BrowserRouter } from 'react-router-dom'
import { StoreApp } from './loja/App.jsx'
import './loja/styles.css'

export function StoreShell({ onLeave, onSignOut }) {
  return (
    <BrowserRouter basename="/loja">
      <div className="loja-lab-bar">
        <button type="button" onClick={onLeave}>
          Agentes
        </button>
        <button type="button" onClick={onSignOut}>
          Sair
        </button>
      </div>
      <StoreApp />
    </BrowserRouter>
  )
}
