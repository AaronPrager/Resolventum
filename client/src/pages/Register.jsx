import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    confirmEmail: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationToken, setVerificationToken] = useState('')

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.email || !form.password || !form.name) {
      setError('Name, Email and Password are required')
      return
    }
    if (form.email !== form.confirmEmail) {
      setError('Emails do not match')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      // Backend currently stores name, email, password; optional fields reserved for future
      const res = await register(form.email, form.password, form.name, form.companyName, form.phone)
      if (res?.ok) {
        setVerificationToken(res?.verification?.token || '')
      }
    } catch (e) {
      setError('Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow p-6 w-full max-w-lg">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Create your account</h1>
        <p className="text-sm text-gray-500 mb-6">Register to start using the platform.</p>

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Name</label>
            <input name="name" value={form.name} onChange={onChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Company Name</label>
            <input name="companyName" value={form.companyName} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Phone (optional)</label>
            <input name="phone" value={form.phone} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={onChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Confirm Email</label>
              <input type="email" name="confirmEmail" value={form.confirmEmail} onChange={onChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Password</label>
              <input type="password" name="password" value={form.password} onChange={onChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Confirm Password</label>
              <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={onChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition-colors">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>

        {verificationToken && (
          <div className="mt-6 p-4 rounded-md border border-indigo-200 bg-indigo-50 text-sm text-indigo-800">
            <div className="font-medium mb-1">Verify your email</div>
            <div className="mb-3">Use this link to verify in this development environment:</div>
            <div className="break-all mb-3">/api/auth/verify?token={verificationToken}</div>
            <div className="flex gap-3">
              <a href={`/api/auth/verify?token=${verificationToken}`} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Open Verify Link</a>
              <button onClick={() => navigate('/')} className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Go to App</button>
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-800">Login</Link>
        </div>
      </div>
    </div>
  )
}


