import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PriceCompareReal from './pages/PriceCompareReal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PriceCompareReal />
  </StrictMode>,
)
