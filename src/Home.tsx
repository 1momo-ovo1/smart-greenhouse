import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import ScrollVideo from './components/ScrollVideo'

gsap.registerPlugin(ScrollTrigger)

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      ScrollTrigger.refresh()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div ref={rootRef} className="relative" style={{ height: '100vh' }}>
      {/* Layer 1: Background Video */}
      <ScrollVideo />

      {/* Center: Smart Greenhouse Text */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <button
            onClick={() => navigate('/greenhouse')}
            className="font-playfair italic text-white text-4xl md:text-5xl lg:text-6xl drop-shadow-md cursor-pointer hover:opacity-80 transition-opacity"
          >
            Smart greenhouse
          </button>
        </div>
      </div>
    </div>
  )
}
