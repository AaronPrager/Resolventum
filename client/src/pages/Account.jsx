import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Upload, X, Building2, Phone, Mail, MapPin, User, DollarSign, Clock, Send } from 'lucide-react'

export function Account() {
  const { user, updateUser } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    address: '',
    logoUrl: '',
    venmo: '',
    zelle: '',
    autoEmailEnabled: false,
    autoEmailTime: '08:00',
    autoEmailAddress: ''
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
      const { data } = await api.get('/profile')
      setProfile(data)
      if (data.logoUrl) {
        // If logoUrl is already a full URL, use it as is
        // If it starts with /uploads, use it directly (will be proxied by Vite)
        // Otherwise, prepend the API base URL
        if (data.logoUrl.startsWith('http')) {
          setLogoPreview(data.logoUrl)
        } else if (data.logoUrl.startsWith('/uploads')) {
          setLogoPreview(data.logoUrl)
        } else {
          setLogoPreview(`${api.defaults.baseURL}${data.logoUrl}`)
        }
      } else {
        setLogoPreview(null)
      }
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', profile.name)
      formData.append('email', profile.email)
      formData.append('companyName', profile.companyName || '')
      formData.append('phone', profile.phone || '')
      formData.append('address', profile.address || '')
      formData.append('venmo', profile.venmo || '')
      formData.append('zelle', profile.zelle || '')
      formData.append('autoEmailEnabled', profile.autoEmailEnabled)
      formData.append('autoEmailTime', profile.autoEmailTime || '')
      formData.append('autoEmailAddress', profile.autoEmailAddress || '')
      
      if (logoFile) {
        formData.append('logo', logoFile)
      }
      
      // If logo was removed
      if (!logoPreview && profile.logoUrl) {
        formData.append('logoUrl', '')
      }

      // Don't set Content-Type header - axios will set it automatically with boundary for FormData
      const { data } = await api.put('/profile', formData)
      
      setProfile(data)
      setLogoFile(null)
      if (data.logoUrl) {
        // If logoUrl is already a full URL, use it as is
        // If it starts with /uploads, use it directly (will be proxied by Vite)
        // Otherwise, prepend the API base URL
        if (data.logoUrl.startsWith('http')) {
          setLogoPreview(data.logoUrl)
        } else if (data.logoUrl.startsWith('/uploads')) {
          setLogoPreview(data.logoUrl)
        } else {
          setLogoPreview(`${api.defaults.baseURL}${data.logoUrl}`)
        }
      } else {
        setLogoPreview(null)
      }
      // Update user context with new name and email
      if (updateUser && user) {
        const updatedUser = { ...user, name: data.name, email: data.email }
        updateUser(updatedUser)
      }
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
        return
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB')
        return
      }

      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) return toast.error('Fill all required fields')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')
    try {
      setLoading(true)
      await api.post('/auth/change-password', { currentPassword, newPassword })
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Profile</h2>
        <p className="text-sm text-gray-500 mb-6">Update your company information. This will be used on invoices and other documents.</p>
        
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
            <div className="flex items-start gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img 
                    src={logoPreview.startsWith('data:') || logoPreview.startsWith('http') || logoPreview.startsWith('/uploads')
                      ? logoPreview 
                      : `${api.defaults.baseURL}${logoPreview}`}
                    alt="Company logo" 
                    className="w-32 h-32 object-contain border border-gray-300 rounded-lg bg-gray-50"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleLogoChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <p className="mt-1 text-xs text-gray-500">PNG, JPG, GIF or WebP. Max 5MB.</p>
              </div>
            </div>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Company Name
            </label>
            <input
              type="text"
              value={profile.companyName || ''}
              onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Your company name"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <User className="w-4 h-4" />
              Your Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <input
              type="email"
              value={profile.email || ''}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="your@email.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone
            </label>
            <input
              type="tel"
              value={profile.phone || ''}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Address
            </label>
            <textarea
              value={profile.address || ''}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="123 Main St, City, State ZIP"
            />
          </div>

          {/* Payment Information Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment Information
            </h3>
            <p className="text-sm text-gray-500 mb-4">Add your payment details to share with students for payments.</p>
            
            {/* Venmo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Venmo Username or Link
              </label>
              <input
                type="text"
                value={profile.venmo || ''}
                onChange={(e) => setProfile({ ...profile, venmo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="@yourvenmo or venmo.com/yourvenmo"
              />
            </div>

            {/* Zelle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zelle Email or Phone
              </label>
              <input
                type="text"
                value={profile.zelle || ''}
                onChange={(e) => setProfile({ ...profile, zelle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="your@email.com or (555) 123-4567"
              />
            </div>
          </div>

          {/* Automatic Email Settings Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Automatic Email Schedule
            </h3>
            <p className="text-sm text-gray-500 mb-4">Configure automatic daily schedule emails to be sent to your email address.</p>
            
            {/* Enable/Disable Toggle */}
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.autoEmailEnabled || false}
                  onChange={(e) => setProfile({ ...profile, autoEmailEnabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Enable automatic daily schedule emails
                </span>
              </label>
            </div>

            {/* Time and Email fields - only show if enabled */}
            {profile.autoEmailEnabled && (
              <>
                {/* Time */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Send Time (24-hour format)
                  </label>
                  <input
                    type="time"
                    value={profile.autoEmailTime || '08:00'}
                    onChange={(e) => setProfile({ ...profile, autoEmailTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required={profile.autoEmailEnabled}
                  />
                  <p className="mt-1 text-xs text-gray-500">Time in 24-hour format (e.g., 08:00 for 8 AM)</p>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.autoEmailAddress || ''}
                    onChange={(e) => setProfile({ ...profile, autoEmailAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="schedule@example.com"
                    required={profile.autoEmailEnabled}
                  />
                  <p className="mt-1 text-xs text-gray-500">Email address where daily schedule will be sent</p>
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={profileLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {profileLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
