import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminPasscode from './pages/AdminPasscode.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminPasscode />
  </StrictMode>,
)
