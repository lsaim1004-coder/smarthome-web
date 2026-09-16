import { Navigate, Route, Routes } from 'react-router-dom'
import { CatalogProvider } from './data/catalog'
import Header from './components/Header'
import WelcomePage from './pages/WelcomePage'
import PackagesPage from './pages/PackagesPage'
import ContactPage from './pages/ContactPage'

/**
 * 공개 사이트에는 로그인이 없다.
 * 로그인해서 보던 것(신청 관리 · 연동 후보 · 자료실)은 관리자 서버(iot-admin.kiwan.kr)로 옮겼다.
 */
export default function App() {
  return (
    <CatalogProvider>
      <div className="page">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="foot">
          <span>iot.kiwan.kr</span>
          <span>Proxmox LXC 111 · docker compose (frontend / backend / db)</span>
        </footer>
      </div>
    </CatalogProvider>
  )
}
