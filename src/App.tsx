import { Routes, Route } from 'react-router-dom'
import Home from './Home'
import GreenhouseDashboard from './GreenhouseDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/greenhouse" element={<GreenhouseDashboard />} />
    </Routes>
  )
}
