import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, X, Trash2, Save, Building2, Tag, CreditCard, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

export function PurchasesSettings() {
  const [frequentVendors, setFrequentVendors] = useState([])
  const [newVendor, setNewVendor] = useState('')
  const [customCategories, setCustomCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [paymentMethods, setPaymentMethods] = useState([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [paymentFormData, setPaymentFormData] = useState({
    type: 'credit_card',
    name: '',
    last4: '',
    bank: '',
    notes: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const [vendorsRes, categoriesRes, paymentMethodsRes] = await Promise.all([
        api.get('/purchases/vendors'),
        api.get('/purchases/settings/categories'),
        api.get('/purchases/settings/payment-methods')
      ])
      setFrequentVendors(vendorsRes.data)
      setCustomCategories(categoriesRes.data)
      setPaymentMethods(paymentMethodsRes.data)
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings')
    }
  }

  const handleAddVendor = async () => {
    if (!newVendor.trim()) {
      toast.error('Vendor name is required')
      return
    }

    try {
      await api.post('/purchases/vendors', { vendor: newVendor.trim() })
      await fetchSettings()
      setNewVendor('')
      toast.success('Vendor added successfully')
    } catch (error) {
      toast.error('Failed to add vendor')
    }
  }

  const handleDeleteVendor = async (vendor) => {
    try {
      await api.delete(`/purchases/vendors/${encodeURIComponent(vendor)}`)
      await fetchSettings()
      toast.success('Vendor removed successfully')
    } catch (error) {
      toast.error('Failed to remove vendor')
    }
  }

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      toast.error('Category name is required')
      return
    }

    try {
      await api.post('/purchases/settings/categories', { category: newCategory.trim() })
      await fetchSettings()
      setNewCategory('')
      toast.success('Category added successfully')
    } catch (error) {
      toast.error('Failed to add category')
    }
  }

  const handleDeleteCategory = async (category) => {
    try {
      await api.delete(`/purchases/settings/categories/${encodeURIComponent(category)}`)
      await fetchSettings()
      toast.success('Category removed successfully')
    } catch (error) {
      toast.error('Failed to remove category')
    }
  }

  const handleOpenPaymentModal = (payment = null) => {
    if (payment) {
      setEditingPayment(payment)
      setPaymentFormData({
        type: payment.type,
        name: payment.name || '',
        last4: payment.last4 || '',
        bank: payment.bank || '',
        notes: payment.notes || ''
      })
    } else {
      setEditingPayment(null)
      setPaymentFormData({
        type: 'credit_card',
        name: '',
        last4: '',
        bank: '',
        notes: ''
      })
    }
    setShowPaymentModal(true)
  }

  const handleSavePayment = async () => {
    if (!paymentFormData.name.trim()) {
      toast.error('Payment method name is required')
      return
    }

    setLoading(true)
    try {
      if (editingPayment) {
        await api.put(`/purchases/settings/payment-methods/${editingPayment.id}`, paymentFormData)
        toast.success('Payment method updated successfully')
      } else {
        await api.post('/purchases/settings/payment-methods', paymentFormData)
        toast.success('Payment method added successfully')
      }
      await fetchSettings()
      setShowPaymentModal(false)
      setEditingPayment(null)
    } catch (error) {
      toast.error('Failed to save payment method')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePayment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payment method?')) {
      return
    }

    try {
      await api.delete(`/purchases/settings/payment-methods/${id}`)
      await fetchSettings()
      toast.success('Payment method deleted successfully')
    } catch (error) {
      toast.error('Failed to delete payment method')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage vendors, categories, and payment methods</p>
        </div>
      </div>

      {/* Frequent Vendors Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Frequent Vendors</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Manage your frequently used vendors. These will appear as suggestions when creating purchases.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newVendor}
            onChange={(e) => setNewVendor(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddVendor()}
            placeholder="Enter vendor name"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddVendor}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        <div className="space-y-2">
          {frequentVendors.length === 0 ? (
            <p className="text-sm text-gray-500">No vendors added yet</p>
          ) : (
            frequentVendors.map((vendor, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm text-gray-900">{vendor}</span>
                <button
                  onClick={() => handleDeleteVendor(vendor)}
                  className="text-red-600 hover:text-red-800"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Custom Categories Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Custom Categories</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Create custom categories for your purchases. Default categories (Supplies, Equipment, etc.) will always be available.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
            placeholder="Enter category name"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddCategory}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        <div className="space-y-2">
          {customCategories.length === 0 ? (
            <p className="text-sm text-gray-500">No custom categories added yet</p>
          ) : (
            customCategories.map((category, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm text-gray-900">{category}</span>
                <button
                  onClick={() => handleDeleteCategory(category)}
                  className="text-red-600 hover:text-red-800"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Methods Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Payment Methods</h2>
          </div>
          <button
            onClick={() => handleOpenPaymentModal()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Payment Method
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Store details about your payment methods (credit cards, bank accounts, etc.) for reference.
        </p>
        <div className="space-y-2">
          {paymentMethods.length === 0 ? (
            <p className="text-sm text-gray-500">No payment methods added yet</p>
          ) : (
            paymentMethods.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{payment.name}</span>
                    <span className="text-xs text-gray-500 capitalize">({payment.type.replace('_', ' ')})</span>
                  </div>
                  {payment.last4 && (
                    <p className="text-xs text-gray-500 mt-1">Last 4: {payment.last4}</p>
                  )}
                  {payment.bank && (
                    <p className="text-xs text-gray-500 mt-1">Bank: {payment.bank}</p>
                  )}
                  {payment.notes && (
                    <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenPaymentModal(payment)}
                    className="text-indigo-600 hover:text-indigo-800"
                    title="Edit"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePayment(payment.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPaymentModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingPayment ? 'Edit Payment Method' : 'Add Payment Method'}
                  </h3>
                  <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={paymentFormData.type}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, type: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="credit_card">Credit Card</option>
                      <option value="debit_card">Debit Card</option>
                      <option value="bank_account">Bank Account</option>
                      <option value="venmo">Venmo</option>
                      <option value="zelle">Zelle</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={paymentFormData.name}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, name: e.target.value })}
                      placeholder="e.g., Business Credit Card, Chase Checking"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 Digits</label>
                    <input
                      type="text"
                      value={paymentFormData.last4}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, last4: e.target.value })}
                      placeholder="e.g., 1234"
                      maxLength={4}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank/Institution</label>
                    <input
                      type="text"
                      value={paymentFormData.bank}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, bank: e.target.value })}
                      placeholder="e.g., Chase, Bank of America"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                      rows={3}
                      placeholder="Additional notes..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePayment}
                      disabled={loading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

