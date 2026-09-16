import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  CBadge,
  CContainer,
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CSidebar,
  CSidebarBrand,
  CSidebarHeader,
  CSidebarNav,
} from '@coreui/react'
import { useAuth } from '../auth/AuthContext'

/**
 * 관리자 공통 틀 — 왼쪽 메뉴 + 위 바.
 *
 * 좁은 화면에서는 메뉴가 접히고 오버레이로 열린다(CoreUI 의 반응형 사이드바).
 * 현장에서 태블릿·휴대폰으로 열어 볼 화면이라 접히는 쪽이 기본이다.
 */

type Item = { to: string; label: string; icon: string; ownerOnly?: boolean }

const ITEMS: Item[] = [
  { to: '/', label: '요약', icon: '▦' },
  { to: '/inquiries', label: '상담 신청', icon: '✉' },
  { to: '/candidates', label: '연동 후보', icon: '⚙' },
  { to: '/packages', label: '패키지 구성', icon: '▤', ownerOnly: true },
  { to: '/products', label: '표준 제품', icon: '⌂', ownerOnly: true },
  { to: '/partners', label: '업체', icon: '☗', ownerOnly: true },
  { to: '/accounts', label: '계정·기록', icon: '☺', ownerOnly: true },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user, owner, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const items = ITEMS.filter((i) => owner || !i.ownerOnly)

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="admin-shell">
      <CSidebar
        className="border-end"
        colorScheme="dark"
        position="fixed"
        visible={open}
        onVisibleChange={(v) => setOpen(v)}
      >
        <CSidebarHeader className="border-bottom">
          <CSidebarBrand className="fw-semibold">
            스마트홈 <span className="text-body-secondary">관리자</span>
          </CSidebarBrand>
        </CSidebarHeader>
        <CSidebarNav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              onClick={() => setOpen(false)}
            >
              <span className="nav-icon-bullet me-2" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
          <a className="nav-link" href="/docs/" target="_blank" rel="noreferrer">
            <span className="nav-icon-bullet me-2" aria-hidden="true">
              ▤
            </span>
            자료실
          </a>
        </CSidebarNav>
      </CSidebar>

      <div className="wrapper d-flex flex-column min-vh-100">
        <CHeader position="sticky" className="mb-3 border-bottom">
          <CContainer fluid className="align-items-center">
            <CHeaderToggler className="d-lg-none" onClick={() => setOpen(!open)} aria-label="메뉴 열기">
              ☰
            </CHeaderToggler>
            <span className="fw-semibold d-none d-sm-inline">스마트홈 옵션 서비스</span>
            <CHeaderNav className="ms-auto align-items-center">
              {user?.role === 'PARTNER' ? (
                <CBadge color="info" className="me-2">
                  {user.partnerName ?? '업체'}
                </CBadge>
              ) : (
                <CBadge color="dark" className="me-2">
                  운영자
                </CBadge>
              )}
              <CDropdown variant="nav-item" placement="bottom-end">
                <CDropdownToggle caret={false}>{user?.name || user?.email}</CDropdownToggle>
                <CDropdownMenu>
                  <CDropdownHeader className="small text-body-secondary">{user?.email}</CDropdownHeader>
                  <CDropdownDivider />
                  <CDropdownItem role="button" onClick={() => void onLogout()}>
                    로그아웃
                  </CDropdownItem>
                </CDropdownMenu>
              </CDropdown>
            </CHeaderNav>
          </CContainer>
        </CHeader>

        <div className="body flex-grow-1">
          <CContainer fluid className="pb-4">
            {children}
          </CContainer>
        </div>

        <footer className="admin-foot border-top">
          <CContainer fluid className="d-flex justify-content-between small text-body-secondary py-2">
            <span>iot-admin.kiwan.kr</span>
            <span>Proxmox LXC 112 · docker compose (admin-web / admin-api)</span>
          </CContainer>
        </footer>
      </div>
    </div>
  )
}
