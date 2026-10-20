// Scroll motion: the page is a body of water.
//  · Smooth scrolling (Lenis) driving GSAP ScrollTrigger.
//  · Depth: the sea darkens and the surface light fades the deeper you scroll.
//  · The dive (one orchestrated moment): the hero holds, its copy lifts away, the showcase jar swells to fill
//    the screen and its water washes over the page, landing on your own shelf of jars.
//  · How it works is a real sequence, so a progress line fills and lights each step in turn.
// Everything is skipped for people who ask for reduced motion.

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

const SURFACE = '#08283a'
const DEEP = '#03111a'

export function useScrollMotion(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    // ---------- smooth scrolling ----------
    const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), anchors: { offset: -76 }, autoRaf: false })
    document.documentElement.classList.add('lenis-on')
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const mm = gsap.matchMedia()
    const ctx = gsap.context(() => {
      // ---------- depth ----------
      const root = document.documentElement
      const sea = gsap.utils.interpolate(SURFACE, DEEP)
      root.style.setProperty('--sea', sea(Math.min(1, (scrollY / Math.max(1, document.body.scrollHeight - innerHeight)) * 2.2)) as string)
      root.style.setProperty('--surface-light', scrollY < 50 ? '1' : '0')
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (st) => {
          const p = st.progress
          root.style.setProperty('--sea', sea(Math.min(1, p * 2.2)) as string)
          root.style.setProperty('--surface-light', String(Math.max(0, 1 - p * 5)))
        },
      })

      // ---------- the dive ----------
      mm.add('(min-width: 768px)', () => {
        const hero = document.querySelector<HTMLElement>('[data-dive="hero"]')
        const copy = document.querySelector<HTMLElement>('[data-dive="copy"]')
        const jar = document.querySelector<HTMLElement>('[data-dive="jar"]')
        const wash = document.querySelector<HTMLElement>('[data-dive="wash"]')
        if (!hero || !copy || !jar || !wash) return
        // how far the jar must travel to sit in the middle of the screen
        // (measured with the hero at the top of the screen, where the pin holds it)
        const toCenter = () => {
          const r = jar.getBoundingClientRect()
          const h = hero.getBoundingClientRect()
          return { x: window.innerWidth / 2 - (r.left + r.width / 2), y: window.innerHeight / 2 - (r.top - h.top + r.height / 2) }
        }
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          // no pin spacing: the shelf rises through the water while the hero holds, so there is no gap after
          scrollTrigger: { trigger: hero, start: 'top top', end: '+=70%', scrub: 0.6, pin: true, pinSpacing: false, anticipatePin: 1, invalidateOnRefresh: true },
        })
        const shelf = document.querySelector<HTMLElement>('#jars')
        // the shelf scrolls up under the hero, so keep it hidden until the water covers the screen
        if (shelf) tl.fromTo(shelf, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.72)
        tl.to(copy, { y: -90, opacity: 0, duration: 0.4 }, 0)
          .to(jar, { x: () => toCenter().x, y: () => toCenter().y, scale: 2.4, duration: 0.75, ease: 'power1.inOut' }, 0)
          .to(wash, { opacity: 1, duration: 0.3, ease: 'power1.in' }, 0.42)
          .to(jar, { opacity: 0, duration: 0.12 }, 0.7)
          .to(wash, { opacity: 0, duration: 0.25, ease: 'power1.out' }, 0.82)
      })

      // ---------- how it works: one step after another ----------
      const steps = gsap.utils.toArray<HTMLElement>('[data-step]')
      const line = document.querySelector<HTMLElement>('[data-steps-line]')
      if (steps.length && line) {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: '[data-steps]', start: 'top 75%', end: 'bottom 55%', scrub: 0.4 },
        })
        tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: steps.length }, 0)
        steps.forEach((s, i) => tl.fromTo(s, { opacity: 0.28 }, { opacity: 1, duration: 0.5 }, i * 0.92))
      }
    })

    // canvases and fonts settle after load; measure again
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    const t = setTimeout(refresh, 600)

    return () => {
      clearTimeout(t)
      window.removeEventListener('load', refresh)
      mm.revert()
      ctx.revert()
      gsap.ticker.remove(raf)
      lenis.destroy()
      document.documentElement.classList.remove('lenis-on')
      document.documentElement.style.removeProperty('--sea')
      document.documentElement.style.removeProperty('--surface-light')
    }
  }, [enabled])
}
