import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Download, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

export function Payments() {
  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    method: 'cash',
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
      
      await api.post('/payments', submitData)
      toast.success('Payment recorded successfully')
      fetchPayments()
      setShowModal(false)
      resetForm()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record payment')
    }
  }

  const resetForm = () => {
    setFormData({
      studentId: '',
      amount: '',
      method: 'cash',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    })
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
        <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Record Payment
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {payments.map((payment) => (
            <li key={payment.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">
                        {payment.student.firstName} {payment.student.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(payment.date).toLocaleDateString()} • {payment.method}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      ${parseFloat(payment.amount).toFixed(2)}
                    </p>
                    <button
                      onClick={() => {
                        const now = new Date()
                        generateInvoice(payment.studentId, now.getMonth() + 1, now.getFullYear())
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Invoice
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => { setShowModal(false); resetForm(); }}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Record Payment
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Student</label>
                      <select
                        required
                        value={formData.studentId}
                        onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="">Select student</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.firstName} {s.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                        <select
                          required
                          value={formData.method}
                          onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Date</label>
                        <input
                          type="date"
                          required
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Record
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

