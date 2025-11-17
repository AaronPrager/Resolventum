import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { Plus, X, Trash2, Edit, Calendar as CalendarIcon, DollarSign, Tag, Building2, CreditCard, Repeat, Save, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

export function Purchases() {
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [purchaseToDelete, setPurchaseToDelete] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterCategory, setFilterCategory] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [customCategories, setCustomCategories] = useState([])
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [showAddVendorModal, setShowAddVendorModal] = useState(false)
  const [newVendorName, setNewVendorName] = useState('')
  const [addingVendor, setAddingVendor] = useState(false)
  const [showAddPaymentMethodModal, setShowAddPaymentMethodModal] = useState(false)
  const [newPaymentMethod, setNewPaymentMethod] = useState({
    type: 'credit_card',
    name: '',
    last4: '',
    bank: '',
    notes: ''
  })
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category: '',
    vendor: '',
    paymentMethod: '',
    notes: '',
    isRecurring: false,
    recurringFrequency: '',
    recurringEndDate: ''
  })

  const defaultCategories = ['Unassigned', 'Supplies', 'Equipment', 'Software', 'Travel', 'Marketing', 'Office', 'Other']
  const [frequentVendors, setFrequentVendors] = useState([])
  const [savedPaymentMethods, setSavedPaymentMethods] = useState([])

  useEffect(() => {
    fetchPurchases()
    fetchFrequentVendors()
    fetchCustomCategories()
    fetchPaymentMethods()
  }, [])

  const fetchCustomCategories = async () => {
    try {
      const { data } = await api.get('/purchases/settings/categories')
      setCustomCategories(data)
    } catch (error) {
      console.error('Failed to load custom categories:', error)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required')
      return
    }

    setAddingCategory(true)
    try {
      await api.post('/purchases/settings/categories', { category: newCategoryName.trim() })
      await fetchCustomCategories()
      setFormData({ ...formData, category: newCategoryName.trim() })
      setNewCategoryName('')
      setShowAddCategoryModal(false)
      toast.success('Category added successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add category')
    } finally {
      setAddingCategory(false)
    }
  }

  const handleAddVendorFromModal = async () => {
    if (!newVendorName.trim()) {
      toast.error('Vendor name is required')
      return
    }

    setAddingVendor(true)
    try {
      await api.post('/purchases/vendors', { vendor: newVendorName.trim() })
      await fetchFrequentVendors()
      setFormData({ ...formData, vendor: newVendorName.trim() })
      setNewVendorName('')
      setShowAddVendorModal(false)
      toast.success('Vendor added successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add vendor')
    } finally {
      setAddingVendor(false)
    }
  }

  const handleAddPaymentMethodFromModal = async () => {
    if (!newPaymentMethod.name.trim()) {
      toast.error('Payment method name is required')
      return
    }

    setAddingPaymentMethod(true)
    try {
      await api.post('/purchases/settings/payment-methods', newPaymentMethod)
      await fetchPaymentMethods()
      setFormData({ ...formData, paymentMethod: newPaymentMethod.name.trim() })
      setNewPaymentMethod({
        type: 'credit_card',
        name: '',
        last4: '',
        bank: '',
        notes: ''
      })
      setShowAddPaymentMethodModal(false)
      toast.success('Payment method added successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add payment method')
    } finally {
      setAddingPaymentMethod(false)
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      const { data } = await api.get('/purchases/settings/payment-methods')
      setSavedPaymentMethods(data)
    } catch (error) {
      console.error('Failed to load payment methods:', error)
    }
  }

  const categories = [...defaultCategories, ...customCategories]

  useEffect(() => {
    fetchPurchases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterYear, filterCategory])

  const fetchFrequentVendors = async () => {
    try {
      const { data } = await api.get('/purchases/vendors')
      setFrequentVendors(data)
    } catch (error) {
      console.error('Failed to load frequent vendors:', error)
    }
  }

  const handleAddVendor = async (vendor) => {
    if (!vendor || !vendor.trim()) return
    
    try {
      await api.post('/purchases/vendors', { vendor: vendor.trim() })
      await fetchFrequentVendors()
      toast.success(`Added "${vendor.trim()}" to frequent vendors`)
    } catch (error) {
      console.error('Failed to add vendor:', error)
      toast.error('Failed to add vendor')
    }
  }

  const fetchPurchases = async () => {
    try {
      const params = {}
      // Filter by month if both month and year are provided
      if (filterMonth && filterYear) {
        const m = parseInt(filterMonth)
        const y = parseInt(filterYear)
        if (!isNaN(m) && m >= 1 && m <= 12 && !isNaN(y) && y >= 2000 && y <= 2100) {
          const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
          const end = new Date(y, m, 0, 23, 59, 59, 999)
          params.startDate = start.toISOString()
          params.endDate = end.toISOString()
        }
      }
      
      // Filter by category if provided
      if (filterCategory) {
        params.category = filterCategory
      }
      
      const { data } = await api.get('/purchases', { params })
      setPurchases(data)
    } catch (error) {
      toast.error('Failed to load purchases')
    }
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedPurchases = [...purchases].sort((a, b) => {
    let aVal = a[sortConfig.key]
    let bVal = b[sortConfig.key]

    if (sortConfig.key === 'date') {
      aVal = new Date(aVal)
      bVal = new Date(bVal)
    } else if (sortConfig.key === 'amount') {
      aVal = parseFloat(aVal)
      bVal = parseFloat(bVal)
    } else {
      aVal = String(aVal || '').toLowerCase()
      bVal = String(bVal || '').toLowerCase()
    }

    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  const handleOpenModal = (purchase = null) => {
    if (purchase) {
      setEditingPurchase(purchase)
      setFormData({
        date: new Date(purchase.date).toISOString().split('T')[0],
        description: purchase.description || '',
        amount: purchase.amount.toString(),
        category: purchase.category || '',
        vendor: purchase.vendor || '',
        paymentMethod: purchase.paymentMethod || '',
        notes: purchase.notes || '',
        isRecurring: purchase.isRecurring || false,
        recurringFrequency: purchase.recurringFrequency || '',
        recurringEndDate: purchase.recurringEndDate ? new Date(purchase.recurringEndDate).toISOString().split('T')[0] : ''
      })
    } else {
      setEditingPurchase(null)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        category: '',
        vendor: '',
        paymentMethod: '',
        notes: '',
        isRecurring: false,
        recurringFrequency: '',
        recurringEndDate: ''
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingPurchase(null)
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      category: '',
      vendor: '',
      paymentMethod: '',
      notes: '',
      isRecurring: false,
      recurringFrequency: '',
      recurringEndDate: ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Client-side validation
    if (!formData.date) {
      toast.error('Date is required')
      return
    }
    if (!formData.description || !formData.description.trim()) {
      toast.error('Description is required')
      return
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Amount is required and must be greater than 0')
      return
    }
    if (formData.isRecurring) {
      if (!formData.recurringFrequency) {
        toast.error('Frequency is required for recurring purchases')
        return
      }
      if (!formData.recurringEndDate) {
        toast.error('Until Date is required for recurring purchases')
        return
      }
      if (new Date(formData.recurringEndDate) < new Date(formData.date)) {
        toast.error('Until Date must be on or after the start date')
        return
      }
    }

    setIsSubmitting(true)

    try {
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        isRecurring: Boolean(formData.isRecurring),
        recurringFrequency: formData.isRecurring && formData.recurringFrequency && formData.recurringFrequency.trim() ? formData.recurringFrequency : null,
        recurringEndDate: formData.isRecurring && formData.recurringEndDate ? formData.recurringEndDate : null,
        paymentMethod: formData.paymentMethod && formData.paymentMethod.trim() ? formData.paymentMethod : null
      }

      if (editingPurchase) {
        await api.put(`/purchases/${editingPurchase.id}`, submitData)
        toast.success('Purchase updated successfully')
      } else {
        const response = await api.post('/purchases', submitData)
        if (response.data.purchases && response.data.purchases.length > 1) {
          toast.success(`Created ${response.data.purchases.length} recurring purchases`)
        } else {
          toast.success('Purchase added successfully')
        }
      }
      fetchPurchases()
      // Refresh frequent vendors if vendor was added
      if (submitData.vendor && submitData.vendor.trim()) {
        await fetchFrequentVendors()
      }
      // Refresh payment methods in case they were updated
      await fetchPaymentMethods()
      handleCloseModal()
    } catch (error) {
      // Only show error if it's not a validation error (which we handle above)
      const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error('Failed to save purchase')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (purchase) => {
    setPurchaseToDelete(purchase)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async (deleteFuture = false) => {
    if (!purchaseToDelete) return

    setIsDeleting(true)
    try {
      const url = deleteFuture ? `/purchases/${purchaseToDelete.id}?deleteFuture=true` : `/purchases/${purchaseToDelete.id}`
      const response = await api.delete(url)
      toast.success(response.data.message || 'Purchase deleted successfully')
      fetchPurchases()
      setShowDeleteModal(false)
      setPurchaseToDelete(null)
    } catch (error) {
      toast.error('Failed to delete purchase')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
    setPurchaseToDelete(null)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`
  }

  const totalAmount = purchases.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
          <p className="text-sm text-gray-500 mt-1">Track your business expenses</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/purchases/settings')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Settings className="h-5 w-5" />
            Settings
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Purchase
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Purchases</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{purchases.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => {
                const month = i + 1
                return (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('date')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    Date
                  </div>
                </th>
                <th
                  onClick={() => handleSort('description')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Description
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Amount
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    Category
                  </div>
                </th>
                <th
                  onClick={() => handleSort('vendor')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    Vendor
                  </div>
                </th>
                <th
                  onClick={() => handleSort('paymentMethod')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-4 w-4" />
                    Payment Method
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <Repeat className="h-4 w-4" />
                    Recurring
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedPurchases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No purchases found. Click "Add Purchase" to get started.
                  </td>
                </tr>
              ) : (
                sortedPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(purchase.date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs">
                        <div className="font-medium">{purchase.description}</div>
                        {purchase.notes && (
                          <div className="text-xs text-gray-500 mt-1 truncate">{purchase.notes}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(purchase.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {purchase.category || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {purchase.vendor || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {purchase.paymentMethod ? (
                        <span>
                          {purchase.paymentMethod === 'credit_card' 
                            ? 'Credit Card' 
                            : purchase.paymentMethod === 'cash'
                            ? 'Cash'
                            : purchase.paymentMethod === 'venmo'
                            ? 'Venmo'
                            : purchase.paymentMethod === 'zelle'
                            ? 'Zelle'
                            : purchase.paymentMethod}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {purchase.isRecurring ? (
                        <span className="inline-flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {purchase.recurringFrequency ? (
                            <span className="capitalize">{purchase.recurringFrequency}</span>
                          ) : 'Yes'}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(purchase)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(purchase)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCloseModal}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingPurchase ? 'Edit Purchase' : 'Add Purchase'}
                  </h3>
                  <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-500">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="e.g., Office supplies"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={formData.category === '__ADD_CATEGORY__' ? '' : formData.category}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_CATEGORY__') {
                          setShowAddCategoryModal(true)
                          // Reset to empty to avoid showing the special value
                          setTimeout(() => setFormData({ ...formData, category: '' }), 0)
                        } else {
                          setFormData({ ...formData, category: e.target.value })
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {categories.filter(cat => cat !== 'Unassigned').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__ADD_CATEGORY__" className="text-indigo-600 font-medium">
                        + Add Category
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                    <select
                      value={formData.vendor === '__ADD_VENDOR__' ? '' : formData.vendor}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_VENDOR__') {
                          setShowAddVendorModal(true)
                          setTimeout(() => setFormData({ ...formData, vendor: '' }), 0)
                        } else {
                          setFormData({ ...formData, vendor: e.target.value })
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select vendor</option>
                      {frequentVendors.map((vendor, idx) => (
                        <option key={idx} value={vendor}>{vendor}</option>
                      ))}
                      <option value="__ADD_VENDOR__" className="text-indigo-600 font-medium">
                        + Add Vendor
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select
                      value={formData.paymentMethod === '__ADD_PAYMENT_METHOD__' ? '' : formData.paymentMethod}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_PAYMENT_METHOD__') {
                          setShowAddPaymentMethodModal(true)
                          setTimeout(() => setFormData({ ...formData, paymentMethod: '' }), 0)
                        } else {
                          setFormData({ ...formData, paymentMethod: e.target.value })
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select payment method</option>
                      {savedPaymentMethods.length > 0 && (
                        <optgroup label="Saved Payment Methods">
                          {savedPaymentMethods.map((method) => (
                            <option key={method.id} value={method.name}>
                              {method.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Quick Options">
                        <option value="cash">Cash</option>
                        <option value="venmo">Venmo</option>
                        <option value="zelle">Zelle</option>
                        <option value="credit_card">Credit Card</option>
                      </optgroup>
                      <option value="__ADD_PAYMENT_METHOD__" className="text-indigo-600 font-medium">
                        + Add Payment Method
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.isRecurring}
                        onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked, recurringFrequency: e.target.checked ? formData.recurringFrequency : '' })}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Recurring Purchase</span>
                    </label>
                  </div>
                  {formData.isRecurring && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                        <select
                          value={formData.recurringFrequency}
                          onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value })}
                          required
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        >
                          <option value="">Select frequency</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Until Date *</label>
                        <input
                          type="date"
                          value={formData.recurringEndDate}
                          onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                          required
                          min={formData.date}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Separate purchase records will be created for each occurrence until this date
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Additional notes..."
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isSubmitting ? 'Saving...' : editingPurchase ? 'Update' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && purchaseToDelete && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleDeleteCancel}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Delete Purchase
                  </h3>
                  <button onClick={handleDeleteCancel} className="text-gray-400 hover:text-gray-500">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-700 mb-2">
                    Are you sure you want to delete this purchase?
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm font-medium text-gray-900">{purchaseToDelete.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(purchaseToDelete.date)} • {formatCurrency(purchaseToDelete.amount)}
                    </p>
                  </div>
                </div>
                {purchaseToDelete.isRecurring && purchaseToDelete.recurringGroupId ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => handleDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="w-full px-4 py-2 bg-blue-400 text-white rounded-md text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                      Delete This Purchase Only
                    </button>
                    <button
                      onClick={() => handleDeleteConfirm(true)}
                      disabled={isDeleting}
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      Delete This and Future Purchases
                    </button>
                    <button
                      onClick={handleDeleteCancel}
                      disabled={isDeleting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleDeleteCancel}
                      disabled={isDeleting}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="px-4 py-2 bg-blue-400 text-white rounded-md text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddCategoryModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Add New Category
                  </h3>
                  <button onClick={() => setShowAddCategoryModal(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                      placeholder="e.g., Software Subscription, Office Supplies"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This category will be saved and available for future purchases
                    </p>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCategoryModal(false)
                        setNewCategoryName('')
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCategory}
                      disabled={addingCategory || !newCategoryName.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {addingCategory ? 'Adding...' : 'Add Category'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddVendorModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddVendorModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Add New Vendor
                  </h3>
                  <button onClick={() => setShowAddVendorModal(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                    <input
                      type="text"
                      value={newVendorName}
                      onChange={(e) => setNewVendorName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddVendorFromModal()}
                      placeholder="e.g., Amazon, Office Depot"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This vendor will be saved and available for future purchases
                    </p>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddVendorModal(false)
                        setNewVendorName('')
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddVendorFromModal}
                      disabled={addingVendor || !newVendorName.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {addingVendor ? 'Adding...' : 'Add Vendor'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddPaymentMethodModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddPaymentMethodModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Add New Payment Method
                  </h3>
                  <button onClick={() => setShowAddPaymentMethodModal(false)} className="text-gray-400 hover:text-gray-500">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={newPaymentMethod.type}
                      onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, type: e.target.value })}
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
                      value={newPaymentMethod.name}
                      onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, name: e.target.value })}
                      placeholder="e.g., Business Credit Card, Chase Checking"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This payment method will be saved and available for future purchases
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 Digits</label>
                    <input
                      type="text"
                      value={newPaymentMethod.last4}
                      onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, last4: e.target.value })}
                      placeholder="e.g., 1234"
                      maxLength={4}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank/Institution</label>
                    <input
                      type="text"
                      value={newPaymentMethod.bank}
                      onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, bank: e.target.value })}
                      placeholder="e.g., Chase, Bank of America"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={newPaymentMethod.notes}
                      onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, notes: e.target.value })}
                      rows={3}
                      placeholder="Additional notes..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddPaymentMethodModal(false)
                        setNewPaymentMethod({
                          type: 'credit_card',
                          name: '',
                          last4: '',
                          bank: '',
                          notes: ''
                        })
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPaymentMethodFromModal}
                      disabled={addingPaymentMethod || !newPaymentMethod.name.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {addingPaymentMethod ? 'Adding...' : 'Add Payment Method'}
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

