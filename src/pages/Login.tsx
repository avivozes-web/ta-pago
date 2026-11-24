import { useState } from 'react'
import { sb, userEmail } from '../lib/sb'
import { Icon } from '../icons'

export default function Login() {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  async function go(e: React.FormEvent) {
    e.preventDefault(); if (!u || !p) return setErr('Preencha usuário e senha.')
    setBusy(true); setErr(null)
    const { error } = await sb.auth.signInWithPassword({ email: userEmail(u), password: p })
    setBusy(false); if (error) setErr(error.message.includes('Invalid') ? 'Usuário ou senha incorretos.' : error.message)
  }
  return <div className="app" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', padding: '0 24px 40px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
      <div className="mk" style={{ width: 56, height: 56, borderRadius: 16 }}><Icon n="check" s={30} sw={2.6} /></div>
      <div className="wm" style={{ fontSize: 26, marginTop: 12 }}>Tá Pago<b>!</b></div>
      <div className="lbl" style={{ marginTop: 4 }}>Dinheiro, casa e rotina da Isa e do Hiago</div>
    </div>
    <form onSubmit={go} className="card" style={{ padding: 16 }}>
      <label className="fl"><span>Usuário</span><input className="fi" autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder="isa ou hiago" value={u} onChange={(e) => setU(e.target.value)} /></label>
      <label className="fl"><span>Senha</span><input className="fi" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} /></label>
      {err && <div className="note neg"><Icon n="alert" /><div className="d">{err}</div></div>}
      <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  </div>
}
