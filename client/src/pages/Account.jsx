import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Upload, X, Building2, Phone, Mail, MapPin, User, DollarSign, Clock, Send, AlertTriangle, Trash2, HardDrive, Cloud, CheckCircle, AlertCircle } from 'lucide-react'

export function Account() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
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
    autoEmailAddress: '',
    fileStorageType: 'googleDrive',
    googleDriveFolderId: ''
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectingGoogleDrive, setConnectingGoogleDrive] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
      const { data } = await api.get('/profile')
      setProfile({
        ...data,
        fileStorageType: data.fileStorageType || 'googleDrive',
        googleDriveFolderId: data.googleDriveFolderId || ''
      })
      setGoogleDriveConnected(!!data.googleDriveAccessToken)
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
      formData.append('fileStorageType', 'googleDrive')
      if (profile.googleDriveFolderId) {
        formData.append('googleDriveFolderId', profile.googleDriveFolderId)
      }
      
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
      // Check for Google Drive connection requirement
      if (error.response?.data?.code === 'GOOGLE_DRIVE_NOT_CONNECTED' || error.response?.data?.requiresGoogleDrive) {
        toast.error('Google Drive connection required to upload logo. Please connect Google Drive below.', {
          duration: 5000
        })
      } else {
        toast.error(error.response?.data?.message || 'Failed to update profile')
      }
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

  const handleDeleteAccount = async () => {
    if (deleteConfirm.toLowerCase() !== 'delete') {
      toast.error('Please type "DELETE" to confirm account deletion')
      return
    }

    try {
      setDeleteLoading(true)
      await api.delete('/profile')
      toast.success('Your account has been deleted')
      logout()
      navigate('/login')
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete account')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleConnectGoogleDrive = async () => {
    try {
      setConnectingGoogleDrive(true)
      const { data } = await api.get('/googledrive/auth-url')
      
      if (!data.authUrl) {
        toast.error('Failed to get Google authentication URL')
        setConnectingGoogleDrive(false)
        return
      }

      // Show message to user
      toast.loading('Redirecting to Google...', { id: 'google-auth' })
      
      // Redirect to Google's OAuth page where user will enter their Google email and password
      window.location.href = data.authUrl
    } catch (error) {
      console.error('Error getting Google auth URL:', error)
      setConnectingGoogleDrive(false)
      toast.error(error.response?.data?.message || 'Failed to connect to Google Drive. Please make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured.')
    }
  }

  const handleDisconnectGoogleDrive = async () => {
    try {
      await api.post('/googledrive/disconnect')
      setGoogleDriveConnected(false)
      toast.success('Google Drive disconnected successfully')
    } catch (error) {
      console.error('Error disconnecting Google Drive:', error)
      toast.error('Failed to disconnect Google Drive')
    }
  }

  const handleTestGoogleDrive = async () => {
    try {
      setTestingConnection(true)
      const { data } = await api.get('/googledrive/test')
      if (data.connected) {
        toast.success('Google Drive connection successful!')
      } else {
        toast.error(data.message || 'Google Drive connection failed')
      }
    } catch (error) {
      console.error('Error testing Google Drive:', error)
      toast.error('Failed to test Google Drive connection')
    } finally {
      setTestingConnection(false)
    }
  }

  // Check for Google Drive callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('googleDriveConnected') === 'true') {
      toast.success('Google Drive connected successfully!')
      loadProfile()
      // Clean up URL
      window.history.replaceState({}, document.title, '/account')
    } else if (urlParams.get('googleDriveError') === 'true') {
      toast.error('Failed to connect Google Drive. Please try again.')
      window.history.replaceState({}, document.title, '/account')
    }
  }, [])

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

          {/* File Storage Settings Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              File Storage
            </h3>
            <p className="text-sm text-gray-500 mb-4">All files are stored in Google Drive. Connect your Google Drive account to enable file uploads.</p>
            
            {/* Google Drive Connection */}
            <div className="p-4 bg-gray-50 rounded-md">
                {googleDriveConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Google Drive Connected</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleTestGoogleDrive}
                        disabled={testingConnection}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-600 rounded-md hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {testingConnection ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectGoogleDrive}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50"
                      >
                        Disconnect
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      Files will be stored in your Google Drive. You can optionally specify a folder ID below to store files in a specific folder.
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Google Drive Folder ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={profile.googleDriveFolderId || ''}
                        onChange={(e) => setProfile({ ...profile, googleDriveFolderId: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Leave empty to use root folder"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        If specified, all files will be stored in this folder. Leave empty to use your Drive root.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Google Drive Not Connected</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Connect your Google Drive account to store files in the cloud. You'll be asked to grant permissions to access your Drive.
                    </p>
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      disabled={connectingGoogleDrive}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connectingGoogleDrive ? 'Connecting...' : 'Connect Google Drive'}
                    </button>
                    {connectingGoogleDrive && (
                      <p className="text-xs text-gray-500 mt-2">
                        You will be redirected to Google to sign in with your Google account.
                      </p>
                    )}
                  </div>
                )}
            </div>
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

      {/* Delete Account Section */}
      <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h2 className="text-lg font-semibold text-red-900">Delete Account</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800 font-semibold mb-2">⚠️ Warning: This action cannot be undone</p>
            <p className="text-sm text-red-700 mb-2">
              Deleting your account will:
            </p>
            <ul className="text-sm text-red-700 list-disc list-inside space-y-1 ml-2">
              <li>Disable login access to your account</li>
              <li>Mark your account as deleted</li>
              <li>Prevent you from accessing your data</li>
            </ul>
            <p className="text-sm text-yellow-800 font-semibold mt-3 mb-2">
              Note: Your account data (students, lessons, payments, etc.) will be preserved in the database but you will not be able to access it.
            </p>
            <p className="text-sm text-red-800 font-semibold">
              This action is permanent and cannot be reversed. You will not be able to log in after deletion.
            </p>
          </div>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete My Account
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800 font-semibold mb-2">
                  Final Confirmation Required
                </p>
                <p className="text-sm text-yellow-700 mb-3">
                  To confirm you want to delete your account, please type <strong>"DELETE"</strong> in the field below:
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || deleteConfirm.toLowerCase() !== 'delete'}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteLoading ? 'Deleting...' : 'Permanently Delete Account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirm('')
                  }}
                  disabled={deleteLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
