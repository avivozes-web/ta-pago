import { addDays, dow } from './cycle.ts'

/** Pausado neste dia: o hábito ou todos, com data de início e (opcional) fim. */
export function isPaused(h: any, d: string, hh: any) {
  return inPause(h?.paused_from, h?.paused_until, d) || inPause(hh?.habits_paused_from, hh?.habits_paused_until, d)
}
export function inPause(from: string | null | undefined, until: string | null | undefined, d: string) {
  if (!from && !until) return false
  if (from && d < from) return false
  if (until && d > until) return false
  return !!(from || until)
}
export function allPausedOn(hh: any, d: string) { return inPause(hh?.habits_paused_from, hh?.habits_paused_until, d) }

/** Retomar hoje: se a pausa começou hoje, limpa; senão termina ontem. */
export function resumePatch(from: string | null | undefined, today: string) {
  if (!from || from >= today) return { paused_from: null, paused_until: null }
  return { paused_until: addDays(today, -1) }
}
export function resumeAllPatch(from: string | null | undefined, today: string) {
  const p = resumePatch(from, today)
  return { habits_paused_from: p.paused_from, habits_paused_until: p.paused_until }
}

/** Constância de um dia: hábitos pausados não entram; hoje só conta o que já foi feito; celular só se marcado. */
export function dayStat(habits: any[], logs: any[], d: string, today: string, hh: any) {
  const logOf = (id: string) => logs.find((l: any) => l.habit_id === id && l.day === d)
  const born = (h: any) => (h.created_at ? new Date(h.created_at).toLocaleDateString('sv-SE') : '2000-01-01')
  const s = habits.filter((h: any) => {
    if (!h.in_grid) return false
    if (h.kind === 'phone' && hh?.max_phone_hours == null) return false
    if (d < born(h)) return false
    if (!(h.days || []).includes(dow(d))) return false
    if (isPaused(h, d, hh)) return false
    const l = logOf(h.id)
    if (h.kind === 'phone') return !!l
    if (d === today) return !!l?.done
    return true
  })
  const n = s.filter((h: any) => logOf(h.id)?.done).length
  return { s: s.length, n }
}
