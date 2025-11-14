import { Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Students } from './pages/Students'
import { StudentDetail } from './pages/StudentDetail'
import { Lessons } from './pages/Lessons'
import { Calendar } from './pages/Calendar'
import { Payments } from './pages/Payments'
import { Reports } from './pages/Reports'
import { Account } from './pages/Account'
import { Verify } from './pages/Verify'
import { Statement } from './pages/Statement'
import { Terms } from './pages/Terms'
import { Privacy } from './pages/Privacy'
import { Disclaimer } from './pages/Disclaimer'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './context/AuthContext'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }
  
  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/disclaimer" element={<Disclaimer />} />
      <Route path="/statement/:studentId" element={<ProtectedRoute><Statement /></ProtectedRoute>} />
      <Route path="/" element={<Layout />}>
        <Route index element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
        <Route path="students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
        <Route path="students/:id" element={<ProtectedRoute><StudentDetail /></ProtectedRoute>} />
        <Route path="lessons" element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
        <Route path="payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="verify" element={<Verify />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App

