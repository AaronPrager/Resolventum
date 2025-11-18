import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, X, Edit, Trash2, Home, DollarSign, Calendar, Percent, Calculator } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { value: 'mortgage_interest', label: 'Mortgage Interest' },
  { value: 'property_taxes', label: 'Property Taxes' },
  { value: 'utilities_electric', label: 'Utilities - Electric' },
  { value: 'utilities_gas', label: 'Utilities - Gas' },
  { value: 'utilities_water', label: 'Utilities - Water' },
  { value: 'home_insurance', label: 'Home Insurance' },
  { value: 'maintenance_repairs', label: 'Maintenance & Repairs' },
  { value: 'depreciation', label: 'Depreciation' }
]

export function HomeOfficeDeductions() {
  const [deductions, setDeductions] = useState([])
  const [summary, setSummary] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingDeduction, setEditingDeduction] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterCategory, setFilterCategory] = useState('')
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    periodType: 'monthly',
    period: new Date().toISOString().split('T')[0],
    deductionPercent: '',
    notes: ''
  })

  useEffect(() => {
    fetchDeductions()
    fetchSummary()
  }, [filterYear, filterCategory])

  const fetchDeductions = async () => {
    try {
      const params = { year: filterYear }
      if (filterCategory) {
        params.category = filterCategory
      }
      const { data } = await api.get('/home-office-deductions', { params })
      setDeductions(data)
    } catch (error) {
      console.error('Failed to load deductions:', error)
      toast.error('Failed to load home office deductions')
    }
  }

  const fetchSummary = async () => {
    try {
      const { data } = await api.get('/home-office-deductions/summary', { params: { year: filterYear } })
      setSummary(data)
    } catch (error) {
      console.error('Failed to load summary:', error)
    }
  }

  const handleOpenModal = (deduction = null) => {
    if (deduction) {
      setEditingDeduction(deduction)
      // Format period for input (YYYY-MM-DD)
      const periodDate = new Date(deduction.period)
      const periodStr = periodDate.toISOString().split('T')[0]
      setFormData({
        category: deduction.category,
        amount: deduction.amount.toString(),
        periodType: deduction.periodType,
        period: periodStr,
        deductionPercent: deduction.deductionPercent.toString(),
        notes: deduction.notes || ''
      })
    } else {
      setEditingDeduction(null)
      setFormData({
        category: '',
        amount: '',
        periodType: 'monthly',
        period: new Date().toISOString().split('T')[0],
        deductionPercent: '',
        notes: ''
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingDeduction(null)
    setFormData({
      category: '',
      amount: '',
      periodType: 'monthly',
      period: new Date().toISOString().split('T')[0],
      deductionPercent: '',
      notes: ''
    })
  }

  const calculateDeductibleAmount = () => {
    const amount = parseFloat(formData.amount) || 0
    const percent = parseFloat(formData.deductionPercent) || 0
    return amount * (percent / 100)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.category || !formData.amount || !formData.deductionPercent) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingDeduction) {
        await api.put(`/home-office-deductions/${editingDeduction.id}`, formData)
        toast.success('Deduction updated successfully')
      } else {
        await api.post('/home-office-deductions', formData)
        toast.success('Deduction added successfully')
      }
      handleCloseModal()
      fetchDeductions()
      fetchSummary()
    } catch (error) {
      console.error('Error saving deduction:', error)
      toast.error(error.response?.data?.message || 'Failed to save deduction')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this deduction?')) {
      return
    }

    try {
      await api.delete(`/home-office-deductions/${id}`)
      toast.success('Deduction deleted successfully')
      fetchDeductions()
      fetchSummary()
    } catch (error) {
      console.error('Error deleting deduction:', error)
      toast.error('Failed to delete deduction')
    }
  }

  const formatPeriod = (period, periodType) => {
    const date = new Date(period)
    if (periodType === 'monthly') {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    } else {
      return date.getFullYear().toString()
    }
  }

  const getCategoryLabel = (categoryValue) => {
    const category = CATEGORIES.find(c => c.value === categoryValue)
    return category ? category.label : categoryValue
  }

  const totalDeductible = deductions.reduce((sum, d) => sum + d.deductibleAmount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Home Office Deductions</h1>
            <p className="text-sm text-gray-500 mt-1">Track and calculate your home office tax deductions</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Deduction
        </button>
      </div>

      {/* Filters and Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Year:</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
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
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Category:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-indigo-50 rounded-md p-4 border border-indigo-200">
              <p className="text-xs text-indigo-600 font-medium">Total Deductible</p>
              <p className="text-2xl font-bold text-indigo-900 mt-1">
                ${summary.totalDeductible.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
              <p className="text-xs text-gray-600 font-medium">Categories</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary.byCategory.length}
              </p>
            </div>
            <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
              <p className="text-xs text-gray-600 font-medium">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {deductions.length}
              </p>
            </div>
            <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
              <p className="text-xs text-gray-600 font-medium">Year</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary.year}
              </p>
            </div>
          </div>
        )}

        {/* Summary by Category */}
        {summary && summary.byCategory.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary by Category</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {summary.byCategory.map((item) => (
                <div key={item.category} className="bg-gray-50 rounded-md p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">{item.label}</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    ${item.totalDeductible.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Total: ${item.totalAmount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deductions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deduction %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deductible Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deductions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">
                    No deductions found. Click "Add Deduction" to get started.
                  </td>
                </tr>
              ) : (
                deductions.map((deduction) => (
                  <tr key={deduction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getCategoryLabel(deduction.category)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPeriod(deduction.period, deduction.periodType)}
                      <span className="ml-2 text-xs text-gray-400">
                        ({deduction.periodType})
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${deduction.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {deduction.deductionPercent.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600">
                      ${deduction.deductibleAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {deduction.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(deduction)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(deduction.id)}
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
            {deductions.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="4" className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    Total Deductible:
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-indigo-600">
                    ${totalDeductible.toFixed(2)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={handleCloseModal}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingDeduction ? 'Edit Deduction' : 'Add Home Office Deduction'}
                  </h3>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select category</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Period Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Period Type *
                    </label>
                    <select
                      required
                      value={formData.periodType}
                      onChange={(e) => setFormData({ ...formData, periodType: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  {/* Period Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.periodType === 'monthly' ? 'Month' : 'Year'} *
                    </label>
                    <input
                      type={formData.periodType === 'monthly' ? 'month' : 'number'}
                      required
                      value={formData.periodType === 'monthly' 
                        ? formData.period.substring(0, 7)
                        : new Date(formData.period).getFullYear()}
                      onChange={(e) => {
                        if (formData.periodType === 'monthly') {
                          setFormData({ ...formData, period: e.target.value + '-01' })
                        } else {
                          setFormData({ ...formData, period: `${e.target.value}-01-01` })
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount ({formData.periodType === 'monthly' ? 'per month' : 'per year'}) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Deduction Percentage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deduction Percentage *
                    </label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        required
                        value={formData.deductionPercent}
                        onChange={(e) => setFormData({ ...formData, deductionPercent: e.target.value })}
                        className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 text-sm"
                        placeholder="0.0"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Percentage of home used for business (0-100%)
                    </p>
                  </div>

                  {/* Calculated Deductible Amount */}
                  <div className="bg-indigo-50 rounded-md p-3 border border-indigo-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Calculator className="h-4 w-4 text-indigo-600" />
                      <label className="text-sm font-medium text-indigo-900">
                        Deductible Amount
                      </label>
                    </div>
                    <p className="text-2xl font-bold text-indigo-900">
                      ${calculateDeductibleAmount().toFixed(2)}
                    </p>
                    <p className="text-xs text-indigo-600 mt-1">
                      {formData.amount || '0'} × {formData.deductionPercent || '0'}%
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Optional notes..."
                    />
                  </div>

                  {/* Form Actions */}
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
                      {isSubmitting ? 'Saving...' : editingDeduction ? 'Update' : 'Add Deduction'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

