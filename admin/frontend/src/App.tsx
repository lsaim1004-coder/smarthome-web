import { Navigate, Route, Routes } from 'react-router-dom'
import { CSpinner } from '@coreui/react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import InquiriesPage from './pages/InquiriesPage'
import InquiryDetailPage from './pages/InquiryDetailPage'
import CandidatesPage from './pages/CandidatesPage'
import PackagesPage from './pages/PackagesPage'
import ProductsPage from './pages/ProductsPage'
import PartnersPage from './pages/PartnersPage'
import AccountsPage from './pages/AccountsPage'

/** 로그인 안 했으면 로그인 화면으로. 운영자 전용 화면은 업체 계정이 들어오면 요약으로 되돌린다. */
function Guard({ children, ownerOnly = false }: { children: React.ReactNode; ownerOnly?: boolean }) {
  const { user, loading, owner } = useAuth()
  if (loading) {
    return (
      <div className="login-shell">
        <CSpinner color="primary" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (ownerOnly && !owner) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

function Shell() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Guard><DashboardPage /></Guard>} />
      <Route path="/inquiries" element={<Guard><InquiriesPage /></Guard>} />
      <Route path="/inquiries/:id" element={<Guard><InquiryDetailPage /></Guard>} />
      <Route path="/candidates" element={<Guard ownerOnly><CandidatesPage /></Guard>} />
      <Route path="/packages" element={<Guard ownerOnly><PackagesPage /></Guard>} />
      <Route path="/products" element={<Guard ownerOnly><ProductsPage /></Guard>} />
      <Route path="/partners" element={<Guard ownerOnly><PartnersPage /></Guard>} />
      <Route path="/accounts" element={<Guard ownerOnly><AccountsPage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
