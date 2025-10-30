import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Download, DollarSign, ChevronUp, ChevronDown, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function Payments() {
  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    method: 'venmo',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  })

  useEffect(() => {
    fetchPayments()
    fetchStudents()
  }, [])

  const fetchPayments = async () => {
    try {
      const { data } = await api.get('/payments')
      setPayments(data)
    } catch (error) {
      toast.error('Failed to load payments')
    }
  }

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students')
      setStudents(data)
    } catch (error) {
      toast.error('Failed to load students')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Ensure date is properly formatted
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString()
      }
      
      if (editingPayment) {
        await api.put(`/payments/${editingPayment.id}`, submitData)
        toast.success('Payment updated successfully')
      } else {
        await api.post('/payments', submitData)
        toast.success('Payment recorded successfully')
      }
      
      fetchPayments()
      setShowModal(false)
      resetForm()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save payment')
    }
  }

  const handleEdit = (payment) => {
    setEditingPayment(payment)
    setFormData({
      studentId: payment.studentId,
      amount: payment.amount.toString(),
      method: payment.method,
      date: new Date(payment.date).toISOString().split('T')[0],
      notes: payment.notes || ''
    })
    setShowModal(true)
  }

  const handleDelete = async () => {
    if (!editingPayment) return
    
    if (window.confirm('Are you sure you want to delete this payment?')) {
      try {
        await api.delete(`/payments/${editingPayment.id}`)
        toast.success('Payment deleted successfully')
        await fetchPayments()
        setShowModal(false)
        resetForm()
      } catch (error) {
        toast.error('Failed to delete payment')
      }
    }
  }

  const handleDeleteDirect = async (paymentId) => {
    try {
      await api.delete(`/payments/${paymentId}`)
      toast.success('Payment deleted successfully')
      await fetchPayments()
    } catch (error) {
      toast.error('Failed to delete payment')
    }
  }

  const resetForm = () => {
    setFormData({
      studentId: '',
      amount: '',
      method: 'venmo',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    })
    setEditingPayment(null)
  }

  const sortData = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedPayments = [...payments].sort((a, b) => {
    let aValue, bValue

    if (sortConfig.key === 'studentName') {
      aValue = `${a.student.firstName} ${a.student.lastName}`.toLowerCase()
      bValue = `${b.student.firstName} ${b.student.lastName}`.toLowerCase()
    } else if (sortConfig.key === 'amount') {
      aValue = parseFloat(a.amount)
      bValue = parseFloat(b.amount)
    } else if (sortConfig.key === 'date') {
      aValue = new Date(a.date)
      bValue = new Date(b.date)
    } else if (sortConfig.key === 'method') {
      aValue = a.method.toLowerCase()
      bValue = b.method.toLowerCase()
    } else {
      return 0
    }

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1
    }
    return 0
  })

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) {
      return <ChevronUp className="h-4 w-4 text-gray-300" />
    }
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="h-4 w-4 text-indigo-600" /> : 
      <ChevronDown className="h-4 w-4 text-indigo-600" />
  }

  const generateInvoice = async (studentId, month, year) => {
    try {
      const response = await api.post(
        `/invoices/generate/${studentId}`,
        { month, year },
        { responseType: 'blob' }
      )
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice-${month}-${year}.pdf`)
      document.body.appendChild(link)
      link.click()
      toast.success('Invoice generated successfully')
    } catch (error) {
      toast.error('Failed to generate invoice')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage student payments
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Payment
        </button>
      </div>

      {sortedPayments.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No payments</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by recording a payment.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  onClick={() => sortData('studentName')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Student
                    <SortIcon column="studentName" />
                  </div>
                </th>
                <th 
                  onClick={() => sortData('amount')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Amount
                    <SortIcon column="amount" />
                  </div>
                </th>
                <th 
                  onClick={() => sortData('date')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Date
                    <SortIcon column="date" />
                  </div>
                </th>
                <th 
                  onClick={() => sortData('method')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Method
                    <SortIcon column="method" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedPayments.map((payment) => (
                <tr 
                  key={payment.id}
                  className="hover:bg-gray-50"
                >
                  <td 
                    onClick={() => handleEdit(payment)}
                    className="px-6 py-2 whitespace-nowrap cursor-pointer"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {payment.student.firstName} {payment.student.lastName}
                    </div>
                  </td>
                  <td 
                    onClick={() => handleEdit(payment)}
                    className="px-6 py-2 whitespace-nowrap cursor-pointer"
                  >
                    <div className="text-sm font-semibold text-gray-900">
                      ${parseFloat(payment.amount).toFixed(2)}
                    </div>
                  </td>
                  <td 
                    onClick={() => handleEdit(payment)}
                    className="px-6 py-2 whitespace-nowrap cursor-pointer"
                  >
                    <div className="text-sm text-gray-900">
                      {new Date(payment.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </td>
                  <td 
                    onClick={() => handleEdit(payment)}
                    className="px-6 py-2 whitespace-nowrap cursor-pointer"
                  >
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm('Are you sure you want to delete this payment?')) {
                          handleDeleteDirect(payment.id)
                        }
                      }}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="Delete payment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-6 pt-5 pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingPayment ? 'Edit Payment' : 'Add Payment'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Student */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Student</label>
                      <div className="flex-1">
                        <select
                          required
                          value={formData.studentId}
                          onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                        >
                          <option value="">Select student</option>
                          {students.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Amount</label>
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-sm text-gray-600">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="w-32 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Method */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Method</label>
                      <div className="flex-1">
                        <select
                          required
                          value={formData.method}
                          onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                        >
                          <option value="venmo">Venmo</option>
                          <option value="zelle">Zelle</option>
                          <option value="cash">Cash</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Date</label>
                      <div className="flex-1">
                        <input
                          type="date"
                          required
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Notes</label>
                      <div className="flex-1">
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm resize-none"
                          placeholder="Optional notes..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
                  <div>
                    {editingPayment && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

