import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useData } from './data'
import { Icon } from './icons'
import { Sheet, Tog } from './ui'
import { DOW_LONG } from './lib/fmt'

export const TUTS: Record<string, { t: string; d: string }[]> = {
  inicio: [
    { t: 'Início', d: 'Aqui você vê o ciclo, o que já entrou e saiu, e um retrato da saúde financeira — tudo calculado das suas contas, sem IA.' },
    { t: 'Sino e áudio', d: 'O sino guarda avisos de limite e as análises. O microfone lança um gasto falando.' },
    { t: 'Livre para gastar', d: 'Se o teto do ciclo estiver definido, este número já desconta o que ainda vai vencer.' },
  ],
  lancar: [
    { t: 'Lançar', d: 'Diga ou escreva o valor e o que foi. O app sugere a categoria pelas palavras que já aprendeu.' },
    { t: 'Parcelas e cartão', d: 'No crédito, informe as parcelas. A fatura entra no ciclo do vencimento.' },
  ],
  cartoes: [
    { t: 'Cartões', d: 'Cada cartão tem fechamento, vencimento, limite e, se quiser, uma meta.' },
    { t: 'Fatura', d: 'Os lançamentos no crédito vão para a fatura do vencimento. Você também pode registrar uma fatura antiga à mão.' },
  ],
  metas: [
    { t: 'Metas', d: 'O teto é o limite de tudo no ciclo. Em cada categoria você pode pôr um limite menor.' },
    { t: 'Cores da barra', d: 'A barra fica amarela a partir de 90% e vermelha quando passa do limite.' },
    { t: 'Nova categoria', d: 'Em “Nova meta” você também pode criar uma categoria nova, com nome, grupo e limite.' },
  ],
  planejamento: [
    { t: 'Planejamento', d: 'Aqui ficam o que você quer guardar, as metas do mês e o “Posso comprar?”.' },
    { t: 'Posso comprar?', d: 'O app só recomenda comprar ou guardar quando, depois de Viver e Curtir, ainda sobra dinheiro.' },
  ],
  casa: [
    { t: 'Casa', d: 'A lista de compras é só sua: você marca e desmarca. As tarefas da casa também ficam aqui.' },
    { t: 'Semanal e mensal', d: 'Tarefas podem ser da semana, da quinzena ou do mês, no dia que você escolher.' },
  ],
  habitos: [
    { t: 'Hábitos', d: 'A sequência conta só os dias em que você fez pelo menos metade do que estava previsto.' },
    { t: 'Pausar', d: 'Em viagem ou doença, pause um hábito ou todos. Os dias pausados não quebram a sequência e não entram na constância da semana.' },
    { t: 'Hoje', d: 'O dia de hoje só entra na conta depois que você marca o que já fez.' },
  ],
}

export function tutorialKey(pathname: string) {
  if (pathname === '/' || pathname === '') return 'inicio'
  if (pathname.startsWith('/dinheiro/cartoes')) return 'cartoes'
  if (pathname.startsWith('/dinheiro/metas')) return 'metas'
  if (pathname.startsWith('/dinheiro/investir') || pathname.startsWith('/dinheiro/posso-comprar')) return 'planejamento'
  if (pathname.startsWith('/casa')) return 'casa'
  if (pathname.startsWith('/eu/habitos')) return 'habitos'
  return null
}

export function Tutorial({ part }: { part?: string }) {
  const loc = useLocation()
  const { db, updHH } = useData()
  const key = part || tutorialKey(loc.pathname)
  const seen: string[] = db?.hh?.tutorials_seen || []
  const firstAsk = db && (db.hh.nickname == null || !db.hh.analyses_asked)
  const [open, setOpen] = useState(false)
  const [force, setForce] = useState(false)
  const [i, setI] = useState(0)
  useEffect(() => {
    const f = (e: any) => {
      if (!key) return
      if (e.detail && e.detail !== key && e.detail !== '*') return
      setI(0); setForce(true); setOpen(true)
    }
    window.addEventListener('tp:help', f)
    return () => window.removeEventListener('tp:help', f)
  }, [key])
  useEffect(() => {
    if (!key || !db || firstAsk) { if (!force) setOpen(false); return }
    if (force) return
    if (seen.includes(key)) { setOpen(false); return }
    setI(0); setOpen(true)
  }, [key, db, firstAsk, force, seen.join('|')])
  if (!open || !key || !TUTS[key] || !db) return null
  const cards = TUTS[key]
  const last = i >= cards.length - 1
  const done = () => {
    setOpen(false); setForce(false)
    if (!seen.includes(key)) updHH({ tutorials_seen: [...seen, key] })
  }
  return <Sheet title={cards[i].t} onClose={done} right={<span className="lbl n">{i + 1} de {cards.length}</span>}>
    <div style={{ fontSize: 15, lineHeight: 1.45, margin: '4px 0 16px' }}>{cards[i].d}</div>
    <div className="row2">
      {i > 0 && <button type="button" className="btn l" onClick={() => setI((x) => x - 1)}>Voltar</button>}
      <button type="button" className="btn" onClick={last ? done : () => setI((x) => x + 1)}>{last ? 'Entendi' : 'Próximo'}</button>
    </div>
  </Sheet>
}

export function FirstRun() {
  const { db, updHH } = useData()
  const [nick, setNick] = useState('')
  const [weekly, setWeekly] = useState(true)
  const [dow, setDow] = useState(1)
  const [monthly, setMonthly] = useState(true)
  const [day, setDay] = useState(15)
  if (!db) return null
  if (db.hh.nickname == null) {
    return <Sheet title="Como você quer ser chamada?" onClose={() => updHH({ nickname: '' })}>
      <div className="lbl" style={{ marginBottom: 8 }}>Fica só aqui, neste aparelho da casa. Você pode mudar depois em Ajustes.</div>
      <input className="fi" autoFocus value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Seu apelido" />
      <div className="row2" style={{ marginTop: 12 }}>
        <button type="button" className="btn l" onClick={() => updHH({ nickname: '' })}>Agora não</button>
        <button type="button" className="btn" onClick={() => updHH({ nickname: nick.trim() || '' })}>Salvar</button>
      </div>
    </Sheet>
  }
  if (!db.hh.analyses_asked) {
    return <Sheet title="Quer análises no sino?" onClose={() => updHH({ analyses_asked: true, analyses_weekly: false, analyses_monthly: false })}>
      <div className="lbl" style={{ marginBottom: 10 }}>São contas simples, como um cafezinho repetido virando o total do mês e do ano. Aparecem só no sino, no dia que você escolher. Pode desligar quando quiser.</div>
      <div className="li"><div><div className="t">Análise da semana</div><div className="d">no dia escolhido</div></div><Tog on={weekly} onClick={() => setWeekly(!weekly)} /></div>
      {weekly && <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '0 0 10px' }}>{DOW_LONG.map((l, i) => <button type="button" key={l} className={'op' + (dow === i ? ' on' : '')} onClick={() => setDow(i)}>{l}</button>)}</div>}
      <div className="li"><div><div className="t">Análise do mês</div><div className="d">no dia escolhido (1 a 28)</div></div><Tog on={monthly} onClick={() => setMonthly(!monthly)} /></div>
      {monthly && <input className="fi" type="number" min={1} max={28} value={day} onChange={(e) => setDay(Math.max(1, Math.min(28, Number(e.target.value) || 1)))} />}
      <div className="row2" style={{ marginTop: 12 }}>
        <button type="button" className="btn l" onClick={() => updHH({ analyses_asked: true, analyses_weekly: false, analyses_monthly: false })}>Agora não</button>
        <button type="button" className="btn" onClick={() => updHH({ analyses_asked: true, analyses_on: true, analyses_weekly: weekly, analyses_weekly_dow: weekly ? dow : null, analyses_monthly: monthly, analyses_monthly_day: monthly ? day : null })}>Salvar</button>
      </div>
    </Sheet>
  }
  return null
}
