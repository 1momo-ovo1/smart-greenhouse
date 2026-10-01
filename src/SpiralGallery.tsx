import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import InfiniteSpiral from './components/InfiniteSpiral'

const images = [
  { src: '/images/landscape-1.svg', alt: 'Mountain lake' },
  { src: '/images/landscape-2.svg', alt: 'Forest path' },
  { src: '/images/landscape-3.svg', alt: 'Rocky summit' },
  { src: '/images/landscape-4.svg', alt: 'Ocean shore' },
  { src: '/images/landscape-5.svg', alt: 'Green meadow' },
  { src: '/images/landscape-6.svg', alt: 'Desert light' },
]

export default function SpiralGallery() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col items-center justify-center">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Title */}
      <h1 className="text-4xl md:text-6xl font-bold mb-8 font-serif italic">
        Infinite Spiral Gallery
      </h1>

      {/* Spiral Gallery */}
      <div style={{ height: '600px', position: 'relative', overflow: 'hidden', width: '100%' }}>
        <InfiniteSpiral
          items={images}
          animationMode="all"
          speed={0.55}
          radius={170}
          cardWidth={100}
          cardHeight={100}
          verticalSpacing={60}
          perspective={1000}
          cardRadius={10}
          centerScale={1.2}
          edgeBlur={6}
          cardsPerTurn={7}
          pauseOnHover
        />
      </div>
    </div>
  )
}
