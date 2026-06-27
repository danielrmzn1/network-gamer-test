import { useEffect, useRef } from 'react'
import { useLang, t } from '../i18n'

/** Rolling latency sparkline on canvas: cyan stroke, fading area fill, glowing endpoint. */
export function Sparkline({ data, height = 170 }: { data: number[]; height?: number }) {
  const lang = useLang()
  const ref = useRef<HTMLCanvasElement>(null)
  // Keep the latest data in a ref so the ResizeObserver callback can redraw
  // without re-subscribing on every sample.
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = (): void => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return // not laid out yet
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // faint baseline grid
      ctx.strokeStyle = 'rgba(40,60,100,0.25)'
      ctx.lineWidth = 1
      for (let i = 1; i < 4; i++) {
        const y = (h / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      const series = dataRef.current
      if (series.length < 2) return

      const pad = 6
      const max = Math.max(...series) * 1.15 || 1
      const min = Math.min(...series) * 0.85
      const range = Math.max(1, max - min)
      const n = series.length
      const x = (i: number): number => (i / (n - 1)) * (w - pad * 2) + pad
      const y = (v: number): number => h - pad - ((v - min) / range) * (h - pad * 2)

      // area fill
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, 'rgba(63,214,201,0.30)')
      grad.addColorStop(1, 'rgba(63,214,201,0)')
      ctx.beginPath()
      ctx.moveTo(x(0), y(series[0]))
      for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(series[i]))
      ctx.lineTo(x(n - 1), h)
      ctx.lineTo(x(0), h)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // line
      ctx.beginPath()
      ctx.moveTo(x(0), y(series[0]))
      for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(series[i]))
      ctx.strokeStyle = '#3fd6c9'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(63,214,201,0.8)'
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.shadowBlur = 0

      // endpoint dot
      const lx = x(n - 1)
      const ly = y(series[n - 1])
      ctx.beginPath()
      ctx.arc(lx, ly, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ece4d2'
      ctx.shadowColor = 'rgba(63,214,201,1)'
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0
    }

    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [data])

  return (
    <div className="px-[26px] py-[22px]">
      <div className="flex justify-between items-center mb-2.5">
        <span className="font-semibold tracking-[0.2em] text-xs leading-[normal] uppercase text-gold">{t(lang, 'latencyOverTime')}</span>
        <span className="text-xs leading-[normal] tracking-[0.05em] text-ink-lo">
          {data.length
            ? `${data[data.length - 1].toFixed(0)} ms ${lang === 'es' ? 'ahora' : 'now'} · ${data.length} ${lang === 'es' ? 'muestras' : 'samples'}`
            : t(lang, 'awaitingSamples')}
        </span>
      </div>
      <canvas ref={ref} className="w-full block" style={{ height }} />
    </div>
  )
}
