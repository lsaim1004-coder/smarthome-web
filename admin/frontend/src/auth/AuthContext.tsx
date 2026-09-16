import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api'

export type AdminUser = {
  id: number
  email: string
  name: string | null
  admin: boolean
  role: 'OWNER' | 'PARTNER' | 'USER'
  partnerId: number | null
  partnerName: string | null
  active: boolean
  emailVerifiedAt: string | null
  createdAt: string | null
  lastLoginAt: string | null
}

type MeResponse = { authenticated: boolean; user: AdminUser | null }

type AuthValue = {
  user: AdminUser | null
  loading: boolean
  owner: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>('/api/auth/me')
      setUser(me.authenticated ? me.user : null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const me = await api<MeResponse>('/api/auth/login', { method: 'POST', json: { email, password } })
    setUser(me.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ user, loading, owner: user?.role === 'OWNER', login, logout, refresh }),
    [user, loading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 안에서만 쓸 수 있습니다.')
  return ctx
}
