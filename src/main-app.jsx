import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './lib/AuthContext.jsx'
import PriceCompareReal from './pages/PriceCompareReal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <PriceCompareReal />
    </AuthProvider>
  </StrictMode>,
)
