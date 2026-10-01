import { useRef, useMemo, useEffect, useCallback } from 'react'
import './InfiniteSpiral.css'

interface SpiralItem {
  src: string
  alt: string
}

interface InfiniteSpiralProps {
  items: SpiralItem[]
  animationMode?: 'all' | 'center' | 'edges'
  speed?: number
  radius?: number
  cardWidth?: number
  cardHeight?: number
  verticalSpacing?: number
  perspective?: number
  cardRadius?: number
  centerScale?: number
  edgeBlur?: number
  cardsPerTurn?: number
  pauseOnHover?: boolean
}

// Math utilities
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))
const modulo = (n: number, m: number) => ((n % m) + m) % m
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export default function InfiniteSpiral({
  items,
  animationMode = 'all',
  speed = 0.55,
  radius = 170,
  cardWidth = 100,
  cardHeight = 100,
  verticalSpacing = 60,
  perspective = 1000,
  cardRadius = 10,
  centerScale = 1.2,
  edgeBlur = 6,
  cardsPerTurn = 7,
  pauseOnHover = true,
}: InfiniteSpiralProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const progressRef = useRef(0)
  const targetProgressRef = useRef(0)
  const autoSpeedRef = useRef(speed)
  const hoveredRef = useRef(false)
  const visibleRef = useRef(false)
  const draggingRef = useRef(false)
  const lastPointerXRef = useRef(0)
  const velocityRef = useRef(0)

  const totalCards = items.length
  const turnSize = cardsPerTurn
  const anglePerCard = 360 / turnSize

  // Responsive radius
  const getResponsiveRadius = useCallback(() => {
    if (!containerRef.current) return radius
    const containerWidth = containerRef.current.offsetWidth
    return Math.min(radius, containerWidth * 0.35)
  }, [radius])

  // Calculate card position in 3D space
  const getCardTransform = useCallback(
    (index: number, progress: number) => {
      const offset = index + progress * turnSize
      const angle = offset * anglePerCard
      const angleRad = (angle * Math.PI) / 180

      const responsiveRadius = getResponsiveRadius()
      const x = Math.sin(angleRad) * responsiveRadius
      const z = Math.cos(angleRad) * responsiveRadius

      // Vertical position based on offset in spiral
      const y = (offset - totalCards / 2) * verticalSpacing * 0.3

      // Depth-based scaling
      const normalizedZ = (z + responsiveRadius) / (2 * responsiveRadius)
      const scale = 0.6 + normalizedZ * (centerScale - 0.6)

      // Opacity based on depth
      const opacity = 0.3 + normalizedZ * 0.7

      // Blur based on distance from center
      const distFromCenter = Math.abs(normalizedZ - 0.5) * 2
      const blur = distFromCenter * edgeBlur

      return { x, y, z, scale, opacity, blur, angle }
    },
    [anglePerCard, centerScale, edgeBlur, getResponsiveRadius, totalCards, turnSize, verticalSpacing]
  )

  // Render loop
  useEffect(() => {
    const container = containerRef.current
    const stage = stageRef.current
    if (!container || !stage) return

    let rafId: number
    let lastTime = performance.now()

    const render = (time: number) => {
      const delta = (time - lastTime) / 1000
      lastTime = time

      // Auto-scroll when not hovering or dragging
      if (!hoveredRef.current && !draggingRef.current && visibleRef.current) {
        targetProgressRef.current += autoSpeedRef.current * delta
      }

      // Apply velocity decay
      targetProgressRef.current += velocityRef.current
      velocityRef.current *= 0.95

      // Smooth progress interpolation
      progressRef.current += (targetProgressRef.current - progressRef.current) * 0.1

      // Update card positions
      const cards = stage.querySelectorAll('.infinite-spiral__item')
      cards.forEach((card, i) => {
        const el = card as HTMLElement
        const { x, y, z, scale, opacity, blur } = getCardTransform(i, progressRef.current)

        el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`
        el.style.opacity = String(opacity)
        el.style.filter = blur > 0.5 ? `blur(${blur}px)` : 'none'
        el.style.zIndex = String(Math.round(z + 1000))
      })

      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [getCardTransform])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      // Trigger re-render on resize
    })
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Intersection observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
      },
      { threshold: 0.1 }
    )
    intersectionObserver.observe(container)
    return () => intersectionObserver.disconnect()
  }, [])

  // Scroll handler for speed control
  useEffect(() => {
    const onScroll = () => {
      if (visibleRef.current) {
        autoSpeedRef.current = speed
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [speed])

  // Pointer events for drag
  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true
    lastPointerXRef.current = e.clientX
    velocityRef.current = 0
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - lastPointerXRef.current
    lastPointerXRef.current = e.clientX
    const delta = dx * 0.002
    targetProgressRef.current += delta
    velocityRef.current = delta * 0.5
  }

  const handlePointerUp = () => {
    draggingRef.current = false
  }

  const handleMouseEnter = () => {
    if (pauseOnHover) hoveredRef.current = true
  }

  const handleMouseLeave = () => {
    hoveredRef.current = false
  }

  // Memoize card elements
  const cards = useMemo(() => {
    return items.map((item, i) => (
      <div
        key={i}
        className="infinite-spiral__item"
        style={{
          width: cardWidth,
          height: cardHeight,
          borderRadius: cardRadius,
        }}
      >
        <img
          src={item.src}
          alt={item.alt}
          className="infinite-spiral__img"
          draggable={false}
        />
      </div>
    ))
  }, [items, cardWidth, cardHeight, cardRadius])

  return (
    <div
      ref={containerRef}
      className="infinite-spiral"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={stageRef}
        className="infinite-spiral__stage"
        style={{ perspective: `${perspective}px` }}
      >
        {cards}
      </div>
    </div>
  )
}
