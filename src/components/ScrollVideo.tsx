import { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const VIDEO_URL = 'https://stream.mux.com/43NlHXsaMrmyzWamMk87m01fNyxSTekAD669BBAPBNm00.m3u8'

export default function ScrollVideo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [canPlay, setCanPlay] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    let hls: Hls | null = null

    const initHls = () => {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        })
        hls.loadSource(VIDEO_URL)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (hls) {
            hls.currentLevel = hls.levels.length - 1
          }
        })

        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          // Quality switched
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = VIDEO_URL
      }
    }

    initHls()

    const onCanPlay = () => {
      setCanPlay(true)
      if (overlayRef.current) {
        gsap.to(overlayRef.current, {
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => {
            if (overlayRef.current) overlayRef.current.style.display = 'none'
          },
        })
      }
    }

    const onProgress = () => {
      if (video.buffered.length > 0) {
        const p = (video.buffered.end(video.buffered.length - 1) / video.duration) * 100
        setProgress(Math.round(p))
      }
    }

    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('progress', onProgress)

    // Scroll-based video scrubbing
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (video && video.duration) {
            const scrollTop = window.scrollY
            const docHeight = document.documentElement.scrollHeight - window.innerHeight
            const scrollPercent = scrollTop / docHeight
            const targetTime = scrollPercent * video.duration
            if (Math.abs(video.currentTime - targetTime) > 0.1) {
              video.currentTime = targetTime
            }
          }
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    // Mouse parallax
    const onMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window
      const x = (e.clientX / innerWidth - 0.5) * 60
      const y = (e.clientY / innerHeight - 0.5) * 60
      gsap.to(container, {
        x: -x,
        y: -y,
        duration: 1.2,
        ease: 'power2.out',
      })
    }

    window.addEventListener('mousemove', onMouseMove)

    return () => {
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('progress', onProgress)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousemove', onMouseMove)
      if (hls) hls.destroy()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 w-full h-full z-0 scale-[1.05] origin-center"
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover scale-[1.35]"
        muted
        playsInline
        crossOrigin="anonymous"
        autoPlay
      />
      {/* Loading overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black flex items-center justify-center z-10"
      >
        <div className="text-white text-lg font-sans">
          Loading... {progress}%
        </div>
      </div>
    </div>
  )
}
