export function brl(v: number, cents = true) {
  const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })
  return (v < 0 ? '− ' : '') + 'R$ ' + s
}
export function ddmm(s: string) { if (!s) return ''; const [, m, d] = s.split('-'); return `${d}/${m}` }
export const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const DOW_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export function moneyIn(s: string): number | null {
  if (s == null) return null; let t = String(s).trim().replace(/^R\$\s*/, ''); if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}
export function moneyOut(v: number | null | undefined) { if (v == null || (v as any) === '') return ''; const n = Number(v); return (Number.isInteger(n) ? String(n) : n.toFixed(2)).replace('.', ',') }
export const PAY_LABEL: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito' }
