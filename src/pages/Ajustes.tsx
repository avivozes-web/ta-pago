import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data'
import { Icon } from '../icons'
import { Mark, Ic, More, editDel, Add, useForm, Sheet, MACRO_LABEL, cycleRng, Empty } from '../ui'
import { brl } from '../lib/fmt'
import { cycleName, billCycleKey, billDueFor, shiftKey, keyParts, ds } from '../lib/cycle'
import { ddmm, PAY_LABEL } from '../lib/fmt'
import { quickList, QUICK_DEFAULT } from '../lib/quick'
import { norm } from '../lib/parse'
import { APP_VERSION } from '../lib/pwa'
import { expectedFor, cycleData } from '../lib/calc'
import { salaryValueForm, salaryReceivedForm } from '../lancar'

function Sr({ icon, t, d, v, onClick }: { icon: string; t: string; d?: string; v?: any; onClick: () => void }) {
  return <div className="li tap" onClick={onClick}><Ic n={icon} /><div><div className="t">{t}</div>{d && <div className="d">{d}</div>}</div><span className="sp lbl n" style={{ color: 'var(--ink2)' }}>{v}</span><span style={{ color: 'var(--mut2)' }}><Icon n="right" s={16} /></span></div>
}
export default function Ajustes() {
  const ctx = useData(); const { db, currentKey, naming, startDay, today, ins, upd, del, updHH, toast } = ctx; const nav = useNavigate()
  const [form, setForm] = useForm(); const [panel, setPanel] = useState<null | 'cats' | 'words'>(null); const [wq, setWq] = useState('')
  const hh = db!.hh
  const main = db!.cards.find((c: any) => c.is_main) || db!.cards[0]
  const exDue = main ? billDueFor(today, main.closing_day, main.due_day) : null
  const prevDay = (d: string) => { const t = new Date(d + 'T12:00'); t.setDate(t.getDate() - 1); return t.toLocaleDateString('sv-SE') }
  const without = (k: string) => { const o = { ...(hh.cycle_starts || {}) }; delete o[k]; return o }
  const startForm = (k?: string, d?: string) => { const opts = [0, 1, 2].map((n) => shiftKey(currentKey, n)); const kk = k || shiftKey(currentKey, 1)
    setForm({ title: k ? `Início de ${cycleName(k, naming)}` : 'Começar um mês em outro dia', initial: { k: kk, d: d || today }, fields: [
      { k: 'k', label: 'Mês', type: 'select', required: true, options: (k ? [k] : opts).map((x) => ({ v: x, l: `${cycleName(x, naming)} ${keyParts(x).y}` })) },
      { k: 'd', label: 'Começa em', type: 'date', required: true, hint: `O normal é dia ${startDay}. O mês anterior termina na véspera. Faturas do cartão continuam pelo mês do vencimento.` }],
      onSave: (v) => { const { y, m } = keyParts(v.k); const normal = ds(y, m, startDay); if (v.d === normal) return updHH({ cycle_starts: without(v.k) }); if (v.d <= ds(keyParts(shiftKey(v.k, -1)).y, keyParts(shiftKey(v.k, -1)).m, startDay)) { toast('Data cedo demais'); return false } return updHH({ cycle_starts: { ...without(k || ''), [v.k]: v.d } }) } }) }
  const quick = quickList(db, 20)
  const catName = (id: string | null) => db!.categories.find((c: any) => c.id === id)?.name
  const pinnedRaw = (): any[] => (Array.isArray(hh.quick_buttons) ? hh.quick_buttons : QUICK_DEFAULT)
  const pin = (q: any) => updHH({ quick_buttons: [...pinnedRaw(), { label: q.label, description: q.description, category_id: q.category_id, payment: q.payment, card_id: q.card_id }] })
  const unpin = (q: any) => { if (confirm(`Tirar o atalho "${q.label}"?`)) updHH({ quick_buttons: pinnedRaw().filter((b) => b.label !== q.label), quick_hidden: [...(hh.quick_hidden || []), q.description] }) }
  const quickForm = (q?: any) => { const raw = q ? pinnedRaw().find((b) => b.label === q.label) || q : {}
    setForm({ title: q ? `Atalho · ${q.label}` : 'Novo atalho', initial: { label: raw.label || '', description: raw.description || '', category_id: raw.category_id || q?.category_id || '', payment: raw.payment || '', card_id: raw.card_id || '' }, fields: [
      { k: 'label', label: 'Nome no botão', type: 'text', required: true }, { k: 'description', label: 'Descrição no extrato', type: 'text', hint: 'Vazio = igual ao nome' },
      { k: 'category_id', label: 'Categoria', type: 'select', options: db!.categories.map((c: any) => ({ v: c.id, l: c.name })) },
      { k: 'payment', label: 'Pagamento', type: 'ops', options: [{ v: '', l: 'Perguntar' }, ...['dinheiro', 'pix', 'debito', 'credito'].map((v) => ({ v, l: PAY_LABEL[v] }))] },
      { k: 'card_id', label: 'Cartão', type: 'select', options: db!.cards.map((c: any) => ({ v: c.id, l: c.name })) }],
      show: (v) => ({ card_id: v.payment === 'credito' }),
      onSave: (v) => { const row = { label: v.label, description: v.description || v.label, category_id: v.category_id || null, payment: v.payment || null, card_id: v.payment === 'credito' ? v.card_id || null : null }
        const list = pinnedRaw(); return updHH({ quick_buttons: q ? list.map((b) => (b.label === q.label ? row : b)) : [...list, row] }) } }) }
  const incForm = (s?: any) => setForm({ title: s ? 'Editar entrada' : 'Nova entrada recorrente', initial: s ? { ...s, expected_amount: Number(s.expected_amount) } : { is_salary: false }, fields: [
    { k: 'name', label: 'Nome', type: 'text', required: true },
    { k: 'is_salary', label: 'Salário recorrente', type: 'toggle', hint: 'Entra sozinho todo mês no dia do salário' },
    { k: 'aliases', label: 'Outros nomes que você escreve', type: 'text', placeholder: 'ex.: salario isa, isa' }],
    onSave: async (v) => { const row = { name: v.name, is_salary: !!v.is_salary, aliases: v.aliases || '' }; return s ? upd('income', s.id, row) : !!(await ins('income', { ...row, sort: db!.income.length + 1 })) },
    onDelete: s ? () => del('income', s.id) : undefined })
  const catForm = (c?: any) => setForm({ title: c ? 'Editar categoria' : 'Nova categoria', initial: c ? { ...c, goal: c.goal == null ? '' : Number(c.goal) } : { macro: 'viver', is_leisure: false, is_invest: false }, fields: [
    { k: 'name', label: 'Nome', type: 'text', required: true },
    { k: 'macro', label: 'Grupo', type: 'ops', options: [{ v: 'viver', l: 'Viver' }, { v: 'crescer', l: 'Crescer' }, { v: 'curtir', l: 'Curtir' }] },
    { k: 'goal', label: 'Meta por ciclo (opcional)', type: 'money' },
    { k: 'is_leisure', label: 'Saída de lazer', type: 'toggle', hint: 'Conta nas saídas de lazer' }],
    onSave: async (v) => { const row = { name: v.name, macro: v.macro, goal: v.goal, is_leisure: !!v.is_leisure }; return c ? upd('categories', c.id, row) : !!(await ins('categories', { ...row, sort: db!.categories.length + 1 })) },
    onDelete: c ? () => del('categories', c.id) : undefined })
  const wordForm = (w?: any) => setForm({ title: w ? 'Editar palavra' : 'Nova palavra', initial: w ? { ...w } : { category_id: db!.categories[0]?.id }, fields: [
    { k: 'word', label: 'Palavra', type: 'text', required: true, hint: 'Quando aparecer no lançamento, o app escolhe a categoria abaixo.' },
    { k: 'category_id', label: 'Categoria', type: 'select', required: true, options: db!.categories.map((c: any) => ({ v: c.id, l: c.name })) }],
    onSave: async (v) => { const row = { word: norm(v.word), category_id: v.category_id, learned: true }; if (!w && db!.keywords.some((k: any) => k.word === row.word)) { toast('Essa palavra já existe'); return false } return w ? upd('keywords', w.id, row) : !!(await ins('keywords', row)) },
    onDelete: w ? () => del('keywords', w.id) : undefined })
  const exportCsv = () => {
    const catBy = Object.fromEntries(db!.categories.map((c: any) => [c.id, c.name])); const cardBy = Object.fromEntries(db!.cards.map((c: any) => [c.id, c.name]))
    const rows = [['data', 'tipo', 'descricao', 'valor', 'categoria', 'pagamento', 'cartao', 'vence_fatura', 'parcela'], ...db!.tx.map((t: any) => [t.date, t.kind, t.description, String(t.amount).replace('.', ','), catBy[t.category_id] || '', t.payment || '', cardBy[t.card_id] || '', t.bill_due || '', t.installments ? `${t.installment_no}/${t.installments}` : ''])]
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = `tapago-${today}.csv`; a.click()
  }
  const words = db!.keywords.filter((k: any) => !wq || k.word.includes(norm(wq))).sort((a: any, b: any) => Number(b.learned) - Number(a.learned) || a.word.localeCompare(b.word))
  const catBy = Object.fromEntries(db!.categories.map((c: any) => [c.id, c]))
  const manha = db!.habits.filter((h: any) => h.routine === 'manha').length, noite = db!.habits.filter((h: any) => h.routine === 'noite').length
  const nk = shiftKey(currentKey, 1)
  const curSal = cycleData(db, currentKey, today).incomeRows.filter((r: any) => r.source.is_salary)
  const nextSal = cycleData(db, nk, today).incomeRows.filter((r: any) => r.source.is_salary && r.expected > 0)
  return <>
    <div className="hdr"><Mark /><button type="button" className="ib" style={{ marginLeft: 'auto' }} aria-label="fechar" onClick={() => nav(-1)}><Icon n="x" /></button></div>
    <div className="ttl">Ajustes</div>
    <div className="wrap">
      <div className="sec">Ciclo</div>
      <div className="card" style={{ padding: '4px 14px 12px' }}>
        <div className="li tap" onClick={() => setForm({ title: 'Ciclo começa no dia', initial: { d: startDay }, fields: [{ k: 'd', label: 'Dia em que o ciclo começa (dia do salário)', type: 'number', required: true, min: 1, max: 28 }], onSave: (v) => updHH({ cycle_start_day: v.d }) })}><Ic n="cal" /><div><div className="t">Começa no dia</div><div className="d">salário cai dia {startDay}</div></div><span className="sp lbl n" style={{ color: 'var(--ink2)' }}>dia {startDay}</span><span style={{ color: 'var(--mut2)' }}><Icon n="right" s={16} /></span></div>
        <div className="li" style={{ display: 'block' }}><div className="t" style={{ marginBottom: 8 }}>Nome do ciclo</div>
          <div style={{ display: 'flex', background: '#ECEAE5', borderRadius: 9, padding: 3, fontSize: 12 }}>{(['end', 'start'] as const).map((n) => <button type="button" key={n} onClick={() => updHH({ cycle_naming: n })} style={{ flex: 1, textAlign: 'center', padding: 6, ...(naming === n ? { background: '#fff', borderRadius: 7, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.08)' } : { color: 'var(--mut)' }) }}>{n === 'end' ? 'Mês em que termina' : 'Mês em que começa'}</button>)}</div>
          <div className="lbl n" style={{ marginTop: 7 }}>{cycleRng(currentKey, startDay)} = <b style={{ color: 'var(--ink)' }}>{cycleName(currentKey, naming)}</b>{exDue && <> · a fatura que vence {exDue.slice(8)}/{exDue.slice(5, 7)} entra em {cycleName(billCycleKey(exDue, naming), naming)}</>}</div></div>
      </div>
      <div className="sec">Mês que começou antes</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {Object.entries(hh.cycle_starts || {}).sort().map(([k, d]: any) => <div key={k} className="li tap" onClick={() => startForm(k, d)}><Ic n="cal" /><div><div className="t">{cycleName(k, naming)} {keyParts(k).y} começou em {ddmm(d)}</div><div className="d">{cycleName(shiftKey(k, -1), naming)} terminou em {ddmm(prevDay(d))} · o normal seria dia {startDay}</div></div><More items={editDel(() => startForm(k, d), async () => { if (confirm(`Voltar ${cycleName(k, naming)} para o dia ${startDay}?`)) await updHH({ cycle_starts: without(k) }) })} /></div>)}
        {!Object.keys(hh.cycle_starts || {}).length && <div className="lbl" style={{ padding: '10px 0 2px' }}>Quando o salário cai antes do dia {startDay}, marque abaixo. O app pergunta se o mês novo começa naquele dia (os fixos também recomeçam). Fica guardado aqui.</div>}
        {curSal.map((r: any) => <div key={r.source.id} className="li"><Ic n="trend" /><div style={{ minWidth: 0, flex: 1 }}><div className="t">{r.source.name} · {cycleName(currentKey, naming)}</div><div className="d">{r.real.length ? `recebido ${ddmm(r.real[0].date)}` : r.auto ? `previsto no dia ${startDay}` : 'se caiu antes do dia ' + startDay + ', marque aqui'}</div></div><button type="button" className="tag acc" onClick={() => salaryReceivedForm(ctx, r, currentKey, setForm)}>{r.real.length ? 'Editar' : 'Recebi antes'}</button></div>)}
        {nextSal.map((r: any) => <div key={'n'+r.source.id} className="li"><Ic n="trend" /><div style={{ minWidth: 0, flex: 1 }}><div className="t">{r.source.name} · {cycleName(nk, naming)}</div><div className="d">{r.real.length ? `recebido ${ddmm(r.real[0].date)}` : 'chegou antes do dia ' + startDay + '?'}</div></div><button type="button" className="tag acc" onClick={() => salaryReceivedForm(ctx, r, nk, setForm)}>{r.real.length ? 'Editar' : 'Recebi antes'}</button></div>)}
        <Add label="Começar um mês em outro dia" onClick={() => startForm()} /><div style={{ height: 8 }} />
      </div>
      <div className="sec">Atalhos de gastos</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {quick.map((q) => <div key={q.label} className="li tap" onClick={() => q.pinned ? quickForm(q) : pin(q)}><Ic n="bolt" /><div style={{ minWidth: 0, flex: 1 }}><div className="t">{q.label}</div><div className="d">{[catName(q.category_id), q.payment ? PAY_LABEL[q.payment] : 'pergunta o pagamento', q.count ? `usado ${q.count}x` : null].filter(Boolean).join(' · ')}</div></div>
          {q.pinned ? <span className="tag">fixado</span> : <span className="tag acc">do histórico</span>}
          <More items={q.pinned ? editDel(() => quickForm(q), () => unpin(q)) : [{ label: 'Fixar', icon: 'check', onClick: () => pin(q) }, { label: 'Esconder', icon: 'x', neg: true, onClick: () => updHH({ quick_hidden: [...(hh.quick_hidden || []), q.description] }) }]} /></div>)}
        <Add label="Novo atalho" onClick={() => quickForm()} />
        <div className="lbl" style={{ padding: '2px 0 10px' }}>Aparecem no Início. Os mais usados vêm primeiro; o app também sugere os gastos que mais se repetem.</div>
      </div>
      <div className="sec">Lembrete da noite</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        <div className="li tap" onClick={() => setForm({ title: 'Lembrete da noite', initial: { h: hh.reminder_hour ?? '19:00' }, fields: [{ k: 'h', label: 'Aparecer a partir de', type: 'select', options: ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map((v) => ({ v, l: v })), hint: 'Vazio = desligado' }], onSave: (v) => updHH({ reminder_hour: v.h || '' }) })}><Ic n="moon" /><div><div className="t">"Lançou os gastos de hoje?"</div><div className="d">cartão no Início · some quando você lança ou dispensa</div></div><span className="sp lbl n" style={{ color: 'var(--ink2)' }}>{hh.reminder_hour ? `às ${hh.reminder_hour}` : 'desligado'}</span><span style={{ color: 'var(--mut2)' }}><Icon n="right" s={16} /></span></div>
      </div>
      <div className="sec">Entradas recorrentes</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {db!.income.map((s: any) => { const v = s.is_salary ? expectedFor(s, currentKey) : Number(s.expected_amount); return <div key={s.id} className="li tap" onClick={() => (s.is_salary ? salaryValueForm(ctx, s, currentKey, setForm) : incForm(s))}><div><div className="t">{s.name}</div><div className="d">{s.is_salary ? `todo dia ${startDay}, entra sozinho · pode ter adiantamento` : 'manual: você lança quando entrar'}</div></div><b className="sp n" style={{ fontWeight: 600, color: v ? undefined : 'var(--mut)' }}>{s.is_salary ? (v ? brl(v) : 'definir valor') : ''}</b><span style={{ color: 'var(--mut2)' }}><Icon n="edit" s={15} /></span><More items={editDel(() => incForm(s), async () => { if (confirm(`Apagar "${s.name}"?`)) await del('income', s.id) }, s.is_salary ? [{ label: 'Mudar valor', icon: 'cal', onClick: () => salaryValueForm(ctx, s, currentKey, setForm) }] : [])} /></div> })}
        <Add label="Adicionar entrada" onClick={() => incForm()} /><div style={{ height: 8 }} /></div>
      <div className="sec">Dinheiro</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        <Sr icon="card" t="Cartões" d="fechamento, vencimento, limite e meta" v={db!.cards.length} onClick={() => nav('/dinheiro/cartoes')} />
        <Sr icon="copy" t="Faturas anteriores ao app" d="valores digitados à mão" v={db!.manualBills.length} onClick={() => nav('/dinheiro/cartoes')} />
        <Sr icon="list" t="Categorias" d="Viver, Crescer e Curtir" v={db!.categories.length} onClick={() => setPanel('cats')} />
        <Sr icon="sparkle" t="Palavras aprendidas" d="ex.: docinho → Lanches" v={db!.keywords.length} onClick={() => setPanel('words')} />
        <Sr icon="repeat" t="Gastos fixos" v={db!.fixed.length} onClick={() => nav('/dinheiro/fixos')} />
        <Sr icon="target" t="Metas e alertas" v={db!.categories.filter((c: any) => c.goal != null).length} onClick={() => nav('/dinheiro/metas')} />
      </div>
      <div className="sec">Casa e rotina</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        <Sr icon="cart" t="Lista de compras" d="você marca e desmarca" v={db!.shopItems.length} onClick={() => nav('/casa/compras')} />
        <Sr icon="house" t="Tarefas da casa" v={db!.tasks.length} onClick={() => nav('/casa/tarefas')} />
        <Sr icon="sun" t="Hábitos e rotinas" d={`manhã ${manha} · noite ${noite}`} v={db!.habits.length} onClick={() => nav('/eu/habitos')} />
        <Sr icon="heart" t="Wishlist" d="categorias e desejos" v={db!.wishCats.length} onClick={() => nav('/eu/wishlist')} />
      </div>
      <div className="sec">Posso comprar?</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        <div className="li tap" onClick={() => setForm({ title: 'Regra de comprometimento', initial: { p: hh.buy_rule_pct ?? 90 }, fields: [{ k: 'p', label: 'Até quantos % da renda', type: 'number', required: true, min: 1, max: 100, hint: 'Se a soma dos compromissos com a nova compra passar disso, o app diz “eu não compraria agora”.' }], onSave: (v) => updHH({ buy_rule_pct: v.p }) })}><Ic n="target" /><div><div className="t">Regra dos {Number(hh.buy_rule_pct ?? 90)}%</div><div className="d">teto do comprometido no “Posso comprar?”</div></div><span className="sp lbl n" style={{ color: 'var(--ink2)' }}>{Number(hh.buy_rule_pct ?? 90)}%</span><span style={{ color: 'var(--mut2)' }}><Icon n="right" s={16} /></span></div>
        <div className="li tap" onClick={() => setForm({ title: 'Juros do “Não sei”', initial: { p: hh.buy_interest_pct ?? 3 }, fields: [{ k: 'p', label: '% ao mês', type: 'number', required: true, min: 0, max: 20, hint: 'Quando você não sabe se a compra parcelada tem juros, o app usa esta taxa para estimar o total.' }], onSave: (v) => updHH({ buy_interest_pct: v.p }) })}><Ic n="card" /><div><div className="t">Juros quando não sei</div><div className="d">usado no “Posso comprar?” · padrão 3% ao mês</div></div><span className="sp lbl n" style={{ color: 'var(--ink2)' }}>{Number(hh.buy_interest_pct ?? 3)}% a.m.</span><span style={{ color: 'var(--mut2)' }}><Icon n="right" s={16} /></span></div>
      </div>
      <div className="sec">Conta</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        <Sr icon="dl" t="Exportar dados" d="planilha CSV dos lançamentos" onClick={exportCsv} />
      </div>
      <div className="lbl" style={{ textAlign: 'center', margin: '6px 0 4px' }}>Tá Pago! · tudo aqui pode ser editado ou apagado por você</div>
      <div className="lbl" style={{ textAlign: 'center', marginBottom: 8, fontSize: 10 }}>versão {APP_VERSION.slice(0, 16).replace('T', ' ')}</div>
    </div>
    {panel === 'cats' && <Sheet title="Categorias" onClose={() => setPanel(null)}><div className="card" style={{ padding: '2px 14px' }}>
      {db!.categories.map((c: any) => <div key={c.id} className="li tap" onClick={() => catForm(c)}><div><div className="t">{c.name}</div><div className="d">{MACRO_LABEL[c.macro]}{c.is_leisure ? ' · lazer' : ''}{c.goal != null ? ` · meta ${brl(Number(c.goal), false)}` : ''} · {db!.keywords.filter((k: any) => k.category_id === c.id).length} palavras</div></div><span className="sp" /><More items={editDel(() => catForm(c), async () => { if (confirm(`Apagar a categoria "${c.name}"? Os gastos ficam sem categoria.`)) await del('categories', c.id) })} /></div>)}
      <Add label="Nova categoria" onClick={() => catForm()} /><div style={{ height: 8 }} /></div></Sheet>}
    {panel === 'words' && <Sheet title="Palavras" onClose={() => setPanel(null)}>
      <div className="lbl" style={{ marginBottom: 8 }}>Sem IA: o app procura estas palavras no que você escreve. Quando você troca a categoria de um gasto, ele aprende a palavra.</div>
      <input className="fi" placeholder="Buscar palavra" value={wq} onChange={(e) => setWq(e.target.value)} style={{ marginBottom: 8 }} />
      <div className="card" style={{ padding: '2px 14px' }}>{words.length === 0 && <Empty>Nenhuma.</Empty>}
        {words.slice(0, 200).map((k: any) => <div key={k.id} className="li tap" style={{ minHeight: 38, padding: '6px 0' }} onClick={() => wordForm(k)}><div className="t">{k.word}</div><span className="lbl">→ {catBy[k.category_id]?.name}</span>{k.learned && <span className="tag acc">aprendida</span>}<span className="sp" /><More items={editDel(() => wordForm(k), () => del('keywords', k.id))} /></div>)}
        <Add label="Nova palavra" onClick={() => wordForm()} /><div style={{ height: 8 }} /></div></Sheet>}
    {form}
  </>
}
