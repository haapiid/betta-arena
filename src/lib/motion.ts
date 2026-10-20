// Scroll motion for the walk (GSAP + ScrollTrigger + Lenis). Everything is off for reduced motion.
//  · smooth scrolling; the bar slides away while you walk down and returns when you scroll up; a progress line
//  · ringside: the ring lifts and the copy drifts off as you leave it
//  · the rule board: the signs drop onto the board one after another
//  · the shelf: jars rise onto the plank
//  · the bell: the tank fills to its level, the tickets print out
//  · the deep: the counter rolls up to the number

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

export function useScrollMotion(enabled: boolean, walk = true) {
  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -64 }, autoRaf: false })
    document.documentElement.classList.add('lenis-on')
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (t: number) => lenis.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const ctx = gsap.context(() => {
      if (!walk) return
      gsap.fromTo('.progress', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } })
      ScrollTrigger.create({
        start: 240,
        end: 'max',
        onUpdate: (s) => gsap.to('.topbar', { yPercent: s.direction === 1 ? -110 : 0, duration: 0.35, ease: 'power2.out', overwrite: true }),
        onLeaveBack: () => gsap.to('.topbar', { yPercent: 0, duration: 0.35, overwrite: true }),
      })

      gsap
        .timeline({ scrollTrigger: { trigger: '.ringside', start: 'top top', end: 'bottom top', scrub: 0.6 } })
        .to('[data-ring="copy"]', { y: -100, opacity: 0, ease: 'power1.in' }, 0)
        .to('[data-ring="stage"]', { y: -60, scale: 0.94, ease: 'none' }, 0)

      gsap.from('[data-sign]', { y: -60, opacity: 0, stagger: 0.12, duration: 0.7, ease: 'back.out(1.6)', scrollTrigger: { trigger: '#rules', start: 'top 65%' } })
      gsap.from('#shelf [data-jar]', { y: 40, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out', scrollTrigger: { trigger: '#shelf', start: 'top 60%' } })

      const fill = document.querySelector<HTMLElement>('.tank-fill')
      if (fill) gsap.from(fill, { height: '4%', duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: '#bell', start: 'top 60%' } })
      gsap.from('[data-ticket]', { clipPath: 'inset(0 0 100% 0)', stagger: 0.15, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: '#bell', start: 'top 55%' } })

      const count = document.querySelector<HTMLElement>('[data-deep-count]')
      if (count) {
        const o = { v: 0 }
        gsap.to(o, {
          v: 1,
          duration: 2,
          ease: 'power2.out',
          scrollTrigger: { trigger: '#deep', start: 'top 60%' },
          // roll toward whatever the number is now (it keeps changing while live)
          onUpdate: () => {
            const target = Number(count.dataset.value || 0)
            count.textContent = Math.round(target * o.v).toLocaleString('en-US')
          },
        })
      }
    })

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    document.fonts?.ready.then(refresh)
    return () => {
      window.removeEventListener('load', refresh)
      ctx.revert()
      gsap.ticker.remove(raf)
      lenis.destroy()
      document.documentElement.classList.remove('lenis-on')
    }
  }, [enabled, walk])
}
