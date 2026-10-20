// The share card window: any fight on the page can open it. It draws the same card the engine uses
// for link previews, and offers Save, Share and Post on X. A post links to /fight/<n>, whose preview
// on X is this card.

import { useEffect, useRef, useState } from 'react'
import { CARD_H, CARD_W, drawFightCard, postText } from '../card/cards'
import type { Fight } from '../game/ring'
import { getJson } from '../lib/feed'

const EVENT = 'betta:share'
export const openShare = (f: Fight) => window.dispatchEvent(new CustomEvent<Fight>(EVENT, { detail: f }))
const SITE = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')
const host = SITE.replace(/^https?:\/\//, '')

/** Opens the card when the page is visited as /?fight=<n> (the landing of a shared link). */
export function useFightFromLink(fights: Fight[], isDemo: boolean) {
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get('fight'))
    if (!n) return
    const local = fights.find((f) => f.n === n)
    if (local) {
      openShare(local)
      return
    }
    if (!isDemo) getJson<Fight>(`/api/fight/${n}`).then(openShare).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])
}

export function ShareCard({ isDemo }: { isDemo: boolean }) {
  const [fight, setFight] = useState<Fight | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const on = (e: Event) => {
      setNote('')
      setFight((e as CustomEvent<Fight>).detail)
    }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])

  useEffect(() => {
    if (!fight || !canvas.current) return
    let gone = false
    const c = canvas.current
    // the card's fonts must be ready before drawing
    Promise.all([document.fonts.load('400 40px Anton'), document.fonts.load('500 20px "JetBrains Mono"'), document.fonts.load('700 20px "Inter Tight Variable"')]).then(() => {
      if (gone) return
      const ctx = c.getContext('2d')!
      drawFightCard(ctx, fight, host)
      c.toBlob((b) => {
        if (gone || !b) return
        setBlob(b)
        setUrl((u) => {
          if (u) URL.revokeObjectURL(u)
          return URL.createObjectURL(b)
        })
      }, 'image/png')
    })
    return () => {
      gone = true
    }
  }, [fight])

  useEffect(() => {
    if (!fight) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setFight(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [fight])

  if (!fight) return null
  const link = `${SITE}/fight/${fight.n}`
  const text = postText(fight)
  const file = `betta-fight-${fight.n}.png`
  const share = async () => {
    try {
      const f = blob && new File([blob], file, { type: 'image/png' })
      if (f && navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text, url: isDemo ? undefined : link })
      else if (navigator.share) await navigator.share({ text, url: isDemo ? SITE : link })
      else {
        await navigator.clipboard.writeText(`${text}\n${isDemo ? SITE : link}`)
        setNote('Text and link copied.')
      }
    } catch {
      /* the share sheet was closed */
    }
  }
  const tweet = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(isDemo ? SITE : link)}`

  return (
    <div data-lenis-prevent className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setFight(null)} role="dialog" aria-modal="true" aria-label={`Fight #${fight.n} card`}>
      <div className="rise w-full max-w-3xl rounded-2xl border border-[#173543] bg-[#071820] p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="display text-2xl">Fight #{fight.n}</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setFight(null)} autoFocus>
            Close
          </button>
        </div>
        <canvas ref={canvas} width={CARD_W} height={CARD_H} className="block h-auto w-full rounded-xl" />
        {isDemo && <p className="mt-2 text-xs text-[#8eabb6]">Preview card from a demo fight. Real fights get their own link after launch.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn btn-gold btn-sm" href={tweet} target="_blank" rel="noopener noreferrer">
            Post on X
          </a>
          <button className="btn btn-ghost btn-sm" onClick={share}>
            Share
          </button>
          {url && (
            <a className="btn btn-ghost btn-sm" href={url} download={file}>
              Save image
            </a>
          )}
          {!isDemo && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigator.clipboard.writeText(link).then(() => setNote('Link copied.'), () => setNote(link))}
            >
              Copy link
            </button>
          )}
          {note && <span className="self-center text-sm text-[#8eabb6]">{note}</span>}
        </div>
      </div>
    </div>
  )
}
