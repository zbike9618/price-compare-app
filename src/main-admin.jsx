import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminPasscode from './pages/AdminPasscode.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AdminPasscode />
    </AuthProvider>
  </StrictMode>,
)
