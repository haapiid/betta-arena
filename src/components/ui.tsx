import { useEffect, useState, type ReactNode } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { RARITY_COLOR, type Rarity } from '../game/species'

export const SYMBOL = import.meta.env.VITE_TOKEN_SYMBOL || 'BETTA'

// whole numbers stay whole; prize shares can have decimals
export const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })

export function Coin({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      {fmt(n)} <span className="text-dim text-[0.8em]">${SYMBOL}</span>
    </span>
  )
}

export function RarityTag({ r }: { r: Rarity }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em]" style={{ color: RARITY_COLOR[r] }}>
      <span className="size-1.5 rounded-full" style={{ background: RARITY_COLOR[r] }} />
      {r}
    </span>
  )
}

export function Meter({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[0.72rem]">
        <span className="text-dim">{label}</span>
        <span className="num text-text">
          {Math.round(v)}
          {hint && <span className="ml-1.5 text-faint">{hint}</span>}
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  )
}

export const meterColor = (v: number) => (v > 60 ? 'var(--color-good)' : v > 30 ? 'var(--color-warn)' : 'var(--color-bad)')

export function StatChips({ attack, defense, beauty, buff }: { attack: number; defense: number; beauty: number; buff?: { attack: number; defense: number; beauty: number } }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 text-center">
      {(
        [
          ['ATK', attack, 'text-coral', buff?.attack],
          ['DEF', defense, 'text-teal', buff?.defense],
          ['BEAUTY', beauty, 'text-gold', buff?.beauty],
        ] as const
      ).map(([k, v, c, bf]) => (
        <div key={k} className={`rounded-lg bg-white/[0.03] px-1 py-1.5 ring-1 ${bf ? 'ring-good/50' : 'ring-line-soft'}`}>
          <div className="text-[0.6rem] font-semibold tracking-[0.14em] text-faint">{k}</div>
          <div className={`num text-[0.95rem] font-semibold ${c}`}>
            {v}
            {bf ? <sup className="ml-0.5 text-[0.6rem] text-good">+{bf}</sup> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div data-lenis-prevent className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`rise card max-h-[92svh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-4xl' : 'sm:max-w-xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="display text-2xl font-semibold">{title}</div>
          <button className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// "Are you sure?" before spending $BETTA. Sits above any open modal.
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: ReactNode
  children: ReactNode
  confirmLabel: ReactNode
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div data-lenis-prevent className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCancel} role="alertdialog" aria-modal="true">
      <div className="rise card w-full max-w-sm p-6 ring-1 ring-gold/40" onClick={(e) => e.stopPropagation()}>
        <div className="display mb-2 text-xl font-semibold">{title}</div>
        <div className="mb-5 text-sm leading-relaxed text-dim">{children}</div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className="btn btn-gold btn-sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function countdown(ms: number) {
  if (ms <= 0) return 'now'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${sec}s`
  return `${m}m ${sec}s`
}

// what the app is waiting for (a wallet confirmation, the chain, the server)
export function Busy({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[65] flex justify-center px-4" aria-live="polite">
      <div className="rise flex items-center gap-2.5 rounded-full border border-gold/40 bg-panel-2/95 px-4 py-2 text-sm text-text shadow-2xl backdrop-blur">
        <LoaderCircle size={15} className="animate-spin text-gold" /> {text}
      </div>
    </div>
  )
}

export interface Toast {
  id: number
  ok: boolean
  msg: string
}

export function Toasts({ list }: { list: Toast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={`rise pointer-events-auto max-w-md rounded-xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur ${
            t.ok ? 'border-line bg-panel-2/95 text-text' : 'border-bad/40 bg-[#2a0f14]/95 text-[#ffd0d5]'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export function SectionHead({ eyebrow, title, children, id }: { eyebrow: string; title: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-8 flex flex-col gap-3 sm:mb-10 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h2 className="display text-[clamp(2rem,4.2vw,3.2rem)] font-semibold leading-[1.02]">{title}</h2>
      </div>
      {children && <div className="max-w-md text-[0.95rem] leading-relaxed text-dim">{children}</div>}
    </div>
  )
}
