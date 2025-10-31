import { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { api } from '../utils/api'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    
    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        setUser(userData)
      } catch (error) {
        console.error('Error parsing stored user:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
      setUser(data.user)
      toast.success('Login successful!')
      return true
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed')
      return false
    }
  }

  const register = async (email, password, name, companyName, phone) => {
    try {
      const { data } = await api.post('/auth/register', { email, password, name, companyName, phone })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
      setUser(data.user)
      toast.success('Registration successful! Check verification link.')
      return { ok: true, verification: data.verification }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed')
      return { ok: false }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    toast.success('Logged out successfully')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

