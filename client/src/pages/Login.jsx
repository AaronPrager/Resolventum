import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BookOpen, Mail, Lock, Calendar, Users, DollarSign, FileText, Clock, CheckCircle } from 'lucide-react'

export function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const success = await login(formData.email, formData.password)
    setLoading(false)
    if (success) {
      navigate('/')
    }
  }

  const features = [
    { icon: Calendar, title: 'Smart Scheduling', description: 'Manage your lessons with an intuitive calendar view' },
    { icon: Users, title: 'Student Management', description: 'Keep track of all your students in one place' },
    { icon: DollarSign, title: 'Payment Tracking', description: 'Monitor payments and outstanding balances' },
    { icon: FileText, title: 'Detailed Reports', description: 'Generate invoices and financial reports' }
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-indigo-600 rounded-lg p-2 mr-3">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Resolventum</h1>
            </div>
            <div className="flex items-center">
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex">
        {/* Left Side - Marketing Content */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 p-12 flex-col justify-center">
          <div className="max-w-lg">
            <h2 className="text-4xl font-bold text-white mb-4">
              Simplify Your Tutoring Business
            </h2>
            <p className="text-xl text-indigo-100 mb-8">
              All-in-one platform to manage students, schedule lessons, track payments, and grow your tutoring practice.
            </p>

            <div className="space-y-6 mb-8">
              {features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="bg-white/20 rounded-lg p-2">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                      <p className="text-indigo-100">{feature.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center space-x-2 text-indigo-100">
              <CheckCircle className="h-5 w-5" />
              <span>Free to get started</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
                <p className="text-sm text-gray-600">Sign in to continue to your account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                    Create one now
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolventum</h3>
              <p className="text-sm text-gray-600 mb-2">
                Tutoring Management System
              </p>
              <p className="text-sm text-gray-600">
                <a 
                  href="mailto:resolventum@gmail.com" 
                  className="text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  resolventum@gmail.com
                </a>
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link 
                    to="/terms" 
                    className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/privacy" 
                    className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/disclaimer" 
                    className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    Information Collection Disclaimer
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">About</h3>
              <p className="text-sm text-gray-600 mb-2">
                Resolventum is a comprehensive tutoring management system designed to help educators manage students, lessons, payments, and reports efficiently.
              </p>
              <p className="text-sm text-gray-500 mt-4">
                © {new Date().getFullYear()} Resolventum. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

