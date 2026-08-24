import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/resources'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('cw_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('cw_token')
    if (!token) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then((data) => {
        setUser(data)
        localStorage.setItem('cw_user', JSON.stringify(data))
      })
      .catch(() => {
        localStorage.removeItem('cw_token')
        localStorage.removeItem('cw_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials)
    localStorage.setItem('cw_token', data.token)
    const profile = { _id: data._id, name: data.name, email: data.email, role: data.role, avatarColor: data.avatarColor }
    localStorage.setItem('cw_user', JSON.stringify(profile))
    setUser(profile)
    return profile
  }, [])

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload)
    localStorage.setItem('cw_token', data.token)
    const profile = { _id: data._id, name: data.name, email: data.email, role: data.role }
    localStorage.setItem('cw_user', JSON.stringify(profile))
    setUser(profile)
    return profile
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('cw_token')
    localStorage.removeItem('cw_user')
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, isAuthenticated: !!user }),
    [user, loading, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
