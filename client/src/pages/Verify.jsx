import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../utils/api'

export function Verify() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('pending') // pending | success | error
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    const token = searchParams.get('token')
    const run = async () => {
      if (!token) {
        setStatus('error')
        setMessage('Missing verification token.')
        return
      }
      try {
        const { data } = await api.get('/auth/verify', { params: { token } })
        setStatus('success')
        setMessage(data?.message || 'Email verified successfully.')
      } catch (e) {
        setStatus('error')
        setMessage(e.response?.data?.message || 'Verification failed.')
      }
    }
    run()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow p-6 w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Email Verification</h1>
        <p className={`mb-6 ${status === 'success' ? 'text-green-700' : status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{message}</p>
        <div className="space-x-3">
          <Link to="/login" className="inline-block px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Go to Login</Link>
          <Link to="/" className="inline-block px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Home</Link>
        </div>
      </div>
    </div>
  )
}



