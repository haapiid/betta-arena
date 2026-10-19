import { useEffect, useRef } from 'react'

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number) => void

// One requestAnimationFrame loop per canvas; pauses while the canvas is off screen.
export function useCanvasLoop(draw: DrawFn) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let visible = true
    let last = performance.now()
    let w = 0
    let h = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) {
        last = performance.now()
        loop(last)
      }
    })
    io.observe(canvas)

    const loop = (now: number) => {
      cancelAnimationFrame(raf)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = reduced ? 0 : now / 1000
      ctx.clearRect(0, 0, w, h)
      drawRef.current(ctx, w, h, t, reduced ? 0 : dt)
      if (visible && !reduced) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return ref
}
