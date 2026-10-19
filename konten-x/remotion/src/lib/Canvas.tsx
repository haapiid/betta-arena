import { useLayoutEffect, useRef } from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'

// A canvas redrawn on every Remotion frame. `draw` gets a context already scaled so that
// one unit = `unit` px (the game draws its jar at ~400px; we scale it up for 1080p).
export function Canvas({
  width,
  height,
  draw,
  unit = 1,
  style,
}: {
  width: number
  height: number
  unit?: number
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, frame: number) => void
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  useLayoutEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ;(globalThis as { __BETTA_DPR?: number }).__BETTA_DPR = Math.max(1, unit)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.scale(unit, unit)
    draw(ctx, width / unit, height / unit, frame / fps, frame)
  })
  return <canvas ref={ref} width={width} height={height} style={{ width, height, display: 'block', ...style }} />
}
