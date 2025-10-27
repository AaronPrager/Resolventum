import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Students } from './pages/Students'
import { Lessons } from './pages/Lessons'
import { Calendar } from './pages/Calendar'
import { Payments } from './pages/Payments'
import { Reports } from './pages/Reports'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './context/AuthContext'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
        <Route path="lessons" element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
        <Route path="calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
        <Route path="payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
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

