import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import Header from './components/Header'
import WelcomePage from './pages/WelcomePage'
import PackagesPage from './pages/PackagesPage'
import ContactPage from './pages/ContactPage'
import AdminInquiriesPage from './pages/AdminInquiriesPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyPage from './pages/VerifyPage'
import MePage from './pages/MePage'

export default function App() {
  return (
    <AuthProvider>
      <div className="page">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="foot">
          <span>iot.kiwan.kr</span>
          <span>Proxmox LXC 111 · docker compose (frontend / backend / db)</span>
        </footer>
      </div>
    </AuthProvider>
  )
}
