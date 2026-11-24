import { useEffect, useState } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { DataProvider, useData } from './data'
import { Icon } from './icons'
import { Lancar, type LancarInit } from './lancar'
import { Voz } from './voz'
import Inicio from './pages/Inicio'
import Extrato from './pages/Extrato'
import Fixos from './pages/Fixos'
import Fluxo from './pages/Fluxo'
import Cartoes from './pages/Cartoes'
import Metas from './pages/Metas'
import Investir from './pages/Investir'
import Wishlist from './pages/Wishlist'
import Compras from './pages/Compras'
import Habitos from './pages/Habitos'
import Tarefas from './pages/Tarefas'
import Fechamento from './pages/Fechamento'
import Ajustes from './pages/Ajustes'
import { Mark } from './ui'

function Nav() {
  const [open, setOpen] = useState<LancarInit | null>(null); const [voz, setVoz] = useState(false); const loc = useLocation()
  useEffect(() => { const f = (e: any) => { if (e.detail?.voz) { setOpen(null); setVoz(true) } else if (e.detail?.lancar) { setVoz(false); setOpen(e.detail.lancar) } }; window.addEventListener('tp:open', f); return () => window.removeEventListener('tp:open', f) }, [])
  const on = (p: string) => loc.pathname.startsWith(p)
  return <>
    <nav className="nav">
      <NavLink to="/" end className={() => (loc.pathname === '/' || on('/fechamento') ? 'on' : '')}><Icon n="pie" />Início</NavLink>
      <NavLink to="/dinheiro/extrato" className={() => (on('/dinheiro') ? 'on' : '')}><Icon n="wallet" />Dinheiro</NavLink>
      <div style={{ width: 62, display: 'grid', placeItems: 'center' }}><button type="button" className="fab" aria-label="lançar" onClick={() => setOpen({})}><Icon n="plus" /></button></div>
      <NavLink to="/casa/compras" className={() => (on('/casa') ? 'on' : '')}><Icon n="house" />Casa</NavLink>
      <NavLink to="/eu/habitos" className={() => (on('/eu') ? 'on' : '')}><Icon n="user" />Eu</NavLink>
    </nav>
    {open && <Lancar init={open} onClose={() => setOpen(null)} />}
    {voz && <Voz onClose={() => setVoz(false)} />}
  </>
}
function Shell() {
  const { loading, db, error, msg } = useData()
  if (loading && !db) return <div className="app" style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}><Mark /></div>
  if (error && !db?.hh) return <div className="app"><div className="wrap" style={{ paddingTop: 40 }}><div className="note neg"><Icon n="alert" /><div><div className="t">Não consegui abrir</div><div className="d">{error}</div></div></div><button className="btn l" onClick={() => location.reload()}>Tentar de novo</button></div></div>
  return <div className="app">
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/dinheiro/extrato" element={<Extrato />} />
      <Route path="/dinheiro/fluxo" element={<Fluxo />} />
      <Route path="/dinheiro/fixos" element={<Fixos />} />
      <Route path="/dinheiro/cartoes" element={<Cartoes />} />
      <Route path="/dinheiro/metas" element={<Metas />} />
      <Route path="/dinheiro/investir" element={<Investir />} />
      <Route path="/casa/compras" element={<Compras />} />
      <Route path="/casa/tarefas" element={<Tarefas />} />
      <Route path="/eu/habitos" element={<Habitos />} />
      <Route path="/eu/wishlist" element={<Wishlist />} />
      <Route path="/fechamento" element={<Fechamento />} />
      <Route path="/ajustes/*" element={<Ajustes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Nav />
    {msg && <div className="toast" role="status">{msg}</div>}
  </div>
}
export default function App() {
  return <HashRouter><DataProvider><Shell /></DataProvider></HashRouter>
}
