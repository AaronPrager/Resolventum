import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import { 
  Users, 
  Calendar as CalendarIcon, 
  DollarSign, 
  FileText,
  Clock,
  LogOut,
  User
} from 'lucide-react'

export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ companyName: '', logoUrl: '' })
  const [logoUrl, setLogoUrl] = useState(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
      const { data } = await api.get('/profile')
      setProfile(data)
      if (data.logoUrl) {
        if (data.logoUrl.startsWith('http')) {
          setLogoUrl(data.logoUrl)
        } else if (data.logoUrl.startsWith('/uploads')) {
          setLogoUrl(data.logoUrl)
        } else {
          setLogoUrl(`${api.defaults.baseURL}${data.logoUrl}`)
        }
      } else {
        setLogoUrl(null)
      }
  }

  const navItems = [
    { path: '/', icon: CalendarIcon, label: 'Calendar' },
    { path: '/students', icon: Users, label: 'Students' },
    { path: '/lessons', icon: Clock, label: 'Lessons' },
    { path: '/payments', icon: DollarSign, label: 'Payments' },
    { path: '/reports', icon: FileText, label: 'Reports' }
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-indigo-600">Resolventum</h1>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-2" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/account')}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md transition-colors cursor-pointer"
                title="Edit Profile"
              >
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={profile.companyName || 'Company logo'} 
                    className="h-8 w-8 object-contain mr-2 rounded"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <User className="h-4 w-4 mr-2" />
                )}
                <span>{profile.companyName || user?.name}</span>
              </button>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}

