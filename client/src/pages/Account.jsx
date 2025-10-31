import { useState } from 'react'
import { api } from '../utils/api'
import toast from 'react-hot-toast'

export function Account() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) return toast.error('Fill all required fields')
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match')
    try {
      setLoading(true)
      await api.post('/auth/change-password', { currentPassword, newPassword })
      toast.success('Password changed successfully')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Current Password</label>
            <input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">{loading ? 'Saving...' : 'Save Password'}</button>
        </form>
      </div>
    </div>
  )
}


