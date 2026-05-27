import React, { createContext, useState, useCallback, useEffect } from 'react'
import { login as apiLogin, register as apiRegister } from '../api/auth.js'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)

  const login = useCallback(async (credentials) => {
    const result = await apiLogin(credentials)
    localStorage.setItem('token', result.token)
    localStorage.setItem('user', JSON.stringify(result.user))
    setToken(result.token)
    setUser(result.user)
    return result
  }, [])

  const register = useCallback(async (payload) => {
    const result = await apiRegister(payload)
    localStorage.setItem('token', result.token)
    localStorage.setItem('user', JSON.stringify(result.user))
    setToken(result.token)
    setUser(result.user)
    return result
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }, [])

  const value = { user, token, login, register, logout, updateUser, isAuthenticated: !!token }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
