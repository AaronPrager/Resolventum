import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Download, DollarSign, ChevronUp, ChevronDown, X, Trash2, User, Calendar as CalendarIcon, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

export function Payments() {
  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [packages, setPackages] = useState([])
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState(null)
  const [showPackagesList, setShowPackagesList] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [filterStudentId, setFilterStudentId] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [isSubmittingPackage, setIsSubmittingPackage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLinkLessonModal, setShowLinkLessonModal] = useState(false)
  const [availableLessons, setAvailableLessons] = useState([])
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    method: 'venmo',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    applyToFamily: false
  })
  const [selectedStudentFamily, setSelectedStudentFamily] = useState([])

  const [packageForm, setPackageForm] = useState({
    studentId: '',
    name: '10-Hour Package',
    totalHours: 10,
    price: '',
    purchasedAt: new Date().toISOString().split('T')[0],
    expiresAt: '',
    method: 'venmo'
  })

  useEffect(() => {
    fetchPayments()
    fetchStudents()
    fetchPackages()
  }, [])

  useEffect(() => {
    fetchPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStudentId, filterMonth, filterYear])

  const fetchPayments = async () => {
    try {
      const params = {}
      if (filterStudentId) {
        params.studentId = filterStudentId
      }
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
      
      const { data } = await api.get('/payments', { params })
      setPayments(data)
      // Update selected payment if it exists
      if (selectedPayment && data.length > 0) {
        const updatedPayment = data.find(p => p.id === selectedPayment.id)
        if (updatedPayment) {
          setSelectedPayment(updatedPayment)
        }
      }
    } catch (error) {
      toast.error('Failed to load payments')
    }
  }

  const fetchLessonsForStudent = async (studentId) => {
    try {
      const { data } = await api.get('/lessons', {
        params: { studentId }
      })
      setAvailableLessons(data || [])
    } catch (error) {
      console.error('Error fetching lessons:', error)
      toast.error('Failed to load lessons')
      setAvailableLessons([])
    }
  }

  const fetchStudents = async () => {
    try {
      // Fetch only active (non-archived) students
      const { data } = await api.get('/students?includeArchived=false')
      // Sort students alphabetically by first name, then last name
      const sorted = data.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
        return nameA.localeCompare(nameB)
      })
      setStudents(sorted)
    } catch (error) {
      toast.error('Failed to load students')
    }
  }

  const fetchPackages = async () => {
    try {
      const { data } = await api.get('/packages')
      setPackages(data)
    } catch (error) {
      toast.error('Failed to load packages')
    }
  }

  const handleTogglePackageActive = async (pkg) => {
    try {
      await api.put(`/packages/${pkg.id}`, {
        isActive: !pkg.isActive
      })
      toast.success(`Package ${pkg.isActive ? 'deactivated' : 'activated'}`)
      await fetchPackages()
    } catch (error) {
      toast.error('Failed to update package')
    }
  }

  const handleDeletePackage = async (pkg) => {
    const confirmMessage = `Are you sure you want to delete the package "${pkg.name}" for ${pkg.student.firstName} ${pkg.student.lastName}? This action cannot be undone.`
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      await api.delete(`/packages/${pkg.id}`)
      toast.success('Package deleted successfully')
      await fetchPackages()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete package')
    }
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return // Prevent double submission
    
    setIsSubmitting(true)
    try {
      // Check if this is a package payment
      const isPackagePayment = formData.notes && formData.notes.trim().startsWith('Package: ')
      
      // Validate: Package payments cannot be applied to families
      if (isPackagePayment && formData.applyToFamily) {
        toast.error('Package payments cannot be applied to families. Please select a single student.')
        setIsSubmitting(false)
        return
      }
      
      // Validate package payment if applicable
      if (isPackagePayment) {
        const selectedStudent = students.find(s => s.id === formData.studentId)
        
        if (!selectedStudent) {
          toast.error('Please select a student')
          setIsSubmitting(false)
          return
        }
        
        if (!selectedStudent.usePackages) {
          toast.error('This student does not use packages. Please enable packages for this student first.')
          setIsSubmitting(false)
          return
        }
        
        if (!selectedStudent.pricePerPackage) {
          toast.error('This student does not have a package price set.')
          setIsSubmitting(false)
          return
        }
        
        const amount = parseFloat(formData.amount)
        const expectedAmount = parseFloat(selectedStudent.pricePerPackage)
        const amountDiff = Math.abs(amount - expectedAmount)
        
        if (amountDiff > 0.01) {
          toast.error(`Package payment amount ($${amount.toFixed(2)}) must match student's package price ($${expectedAmount.toFixed(2)})`)
          setIsSubmitting(false)
          return
        }
      }
      
      // Ensure date is properly formatted in local time
      // Create date at local midnight to avoid timezone shifts
      const [year, month, day] = formData.date.split('-').map(Number)
      const localDate = new Date(year, month - 1, day, 0, 0, 0, 0)
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: localDate.toISOString()
      }
      
      let updatedPayment;
      if (editingPayment) {
        const { data } = await api.put(`/payments/${editingPayment.id}`, submitData)
        updatedPayment = data
        toast.success('Payment updated successfully')
      } else {
        const { data } = await api.post('/payments', submitData)
        updatedPayment = data
        
        // Check if this was a family payment
        if (formData.applyToFamily && selectedStudentFamily.length > 0) {
          const totalFamilyMembers = selectedStudentFamily.length + 1 // +1 for the selected student
          toast.success(`Payment recorded for ${totalFamilyMembers} family member${totalFamilyMembers > 1 ? 's' : ''}`)
        } else {
          toast.success('Payment recorded successfully')
        }
      }
      
      await fetchPayments()
      
      // Update selected payment if it matches the edited payment
      if (editingPayment && selectedPayment && selectedPayment.id === editingPayment.id) {
        setSelectedPayment(updatedPayment)
      } else if (!editingPayment && updatedPayment) {
        // If creating new payment, optionally select it
        setSelectedPayment(updatedPayment)
      }
      
      setEditingPayment(null)
      setShowModal(false)
      resetForm()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (payment) => {
    setEditingPayment(payment)
    // Format date in local time to avoid timezone shifts
    const paymentDate = new Date(payment.date)
    const localDate = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}-${String(paymentDate.getDate()).padStart(2, '0')}`
    setFormData({
      studentId: payment.studentId,
      amount: payment.amount.toString(),
      method: payment.method,
      date: localDate,
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
      notes: '',
      applyToFamily: false
    })
    setEditingPayment(null)
    setIsSubmitting(false)
    setSelectedStudentFamily([])
  }

  // Update family members when student is selected
  useEffect(() => {
    if (formData.studentId && !editingPayment) {
      const selectedStudent = students.find(s => s.id === formData.studentId)
      if (selectedStudent && selectedStudent.familyId) {
        // Find all students in the same family
        const familyMembers = students.filter(s => 
          s.familyId === selectedStudent.familyId && 
          s.id !== selectedStudent.id && 
          !s.archived
        )
        setSelectedStudentFamily(familyMembers)
      } else {
        setSelectedStudentFamily([])
        // Reset applyToFamily if student has no family
        if (formData.applyToFamily) {
          setFormData(prev => ({ ...prev, applyToFamily: false }))
        }
      }
    } else {
      setSelectedStudentFamily([])
    }
  }, [formData.studentId, students, editingPayment])

  // Update selectedPayment when payments array changes (if it matches)
  useEffect(() => {
    if (selectedPayment && payments.length > 0) {
      const updatedPayment = payments.find(p => p.id === selectedPayment.id)
      if (updatedPayment && JSON.stringify(updatedPayment) !== JSON.stringify(selectedPayment)) {
        setSelectedPayment(updatedPayment)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments])

  const resetPackageForm = () => {
    setPackageForm({
      studentId: '',
      name: '10-Hour Package',
      totalHours: 10,
      price: '',
      purchasedAt: new Date().toISOString().split('T')[0],
      expiresAt: '',
      method: 'venmo'
    })
    setEditingPackage(null)
  }
  
  const handleEditPackage = (pkg) => {
    setEditingPackage(pkg)
    // Format dates in local time to avoid timezone shifts
    const purchasedDate = new Date(pkg.purchasedAt)
    const localPurchasedAt = `${purchasedDate.getFullYear()}-${String(purchasedDate.getMonth() + 1).padStart(2, '0')}-${String(purchasedDate.getDate()).padStart(2, '0')}`
    const expiresDate = pkg.expiresAt ? new Date(pkg.expiresAt) : null
    const localExpiresAt = expiresDate ? `${expiresDate.getFullYear()}-${String(expiresDate.getMonth() + 1).padStart(2, '0')}-${String(expiresDate.getDate()).padStart(2, '0')}` : ''
    setPackageForm({
      studentId: pkg.studentId,
      name: pkg.name,
      totalHours: pkg.totalHours,
      price: pkg.price.toString(),
      purchasedAt: localPurchasedAt,
      expiresAt: localExpiresAt,
      method: 'venmo'
    })
    setShowPackageModal(true)
  }

  const sortData = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const filteredPayments = payments.filter((p) => {
    const matchStudent = filterStudentId ? p.studentId === filterStudentId : true
    return matchStudent
  })

  const sortedPayments = [...filteredPayments].sort((a, b) => {
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

  const handleSubmitPackage = async (e) => {
    e.preventDefault()
    if (isSubmittingPackage) return // Prevent double submission
    setIsSubmittingPackage(true)
    try {
      if (editingPackage) {
        // When editing, only allow updating date, expiration, and deletion
        // Create dates at local midnight to avoid timezone shifts
        const [pYear, pMonth, pDay] = packageForm.purchasedAt.split('-').map(Number)
        const localPurchasedAt = new Date(pYear, pMonth - 1, pDay, 0, 0, 0, 0)
        const submitData = {
          purchasedAt: localPurchasedAt.toISOString(),
          ...(packageForm.expiresAt ? (() => {
            const [eYear, eMonth, eDay] = packageForm.expiresAt.split('-').map(Number)
            const localExpiresAt = new Date(eYear, eMonth - 1, eDay, 0, 0, 0, 0)
            return { expiresAt: localExpiresAt.toISOString() }
          })() : { expiresAt: null })
        }
        
        await api.put(`/packages/${editingPackage.id}`, submitData)
        toast.success('Package updated successfully')
      } else {
        // Creating new package
        // Create dates at local midnight to avoid timezone shifts
        const [pYear, pMonth, pDay] = packageForm.purchasedAt.split('-').map(Number)
        const localPurchasedAt = new Date(pYear, pMonth - 1, pDay, 0, 0, 0, 0)
        const submitData = {
          studentId: packageForm.studentId,
          name: packageForm.name,
          totalHours: parseFloat(packageForm.totalHours),
          price: parseFloat(packageForm.price),
          purchasedAt: localPurchasedAt.toISOString(),
          ...(packageForm.expiresAt ? (() => {
            const [eYear, eMonth, eDay] = packageForm.expiresAt.split('-').map(Number)
            const localExpiresAt = new Date(eYear, eMonth - 1, eDay, 0, 0, 0, 0)
            return { expiresAt: localExpiresAt.toISOString() }
          })() : {})
        }

        // Add payment method to submit data
        submitData.method = packageForm.method

        await api.post('/packages', submitData)

        toast.success('Package created and payment recorded')
      }

      await fetchPayments()
      await fetchPackages()
      setShowPackageModal(false)
      resetPackageForm()
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${editingPackage ? 'update' : 'create'} package`)
    } finally {
      setIsSubmittingPackage(false)
    }
  }

  // no extra filters

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payments List - 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
              <p className="text-sm text-gray-500 mt-1">{payments.length} {payments.length === 1 ? 'payment' : 'payments'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { resetPackageForm(); setShowPackageModal(true); }}
                className="px-2.5 py-1.5 rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-sm"
                title="Add package"
              >
                Add Package
              </button>
              <button
                onClick={() => { resetForm(); setShowModal(true); }}
                className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Add payment"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="px-4 py-2 flex flex-wrap items-center gap-2 text-sm border-b border-gray-200 bg-white">
            <select
              value={filterStudentId}
              onChange={(e) => setFilterStudentId(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-0"
            >
              <option value="">All students</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
            
            <label className="text-gray-700">Month:</label>
            <select
              value={filterMonth}
              onChange={(e) => {
                const val = e.target.value
                setFilterMonth(val)
              }}
              className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-0"
            >
              <option value="">All months</option>
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            
            <label className="text-gray-700">Year:</label>
            <input
              type="number"
              min="2000"
              max="2100"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 w-20 focus:outline-none focus:ring-0"
              placeholder="All years"
            />
            
            {(filterStudentId || (filterMonth && filterYear)) && (
              <span className="text-xs text-gray-500 ml-auto">
                Showing {sortedPayments.length} payment{sortedPayments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Headers */}
          {sortedPayments.length > 0 && (
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-4 flex items-center cursor-pointer hover:text-gray-700" onClick={() => sortData('studentName')}>
                Student
                <SortIcon column="studentName" />
              </div>
              <div className="col-span-3 flex items-center cursor-pointer hover:text-gray-700" onClick={() => sortData('amount')}>
                Amount
                <SortIcon column="amount" />
              </div>
              <div className="col-span-3 flex items-center cursor-pointer hover:text-gray-700" onClick={() => sortData('date')}>
                Date
                <SortIcon column="date" />
              </div>
              <div className="col-span-2 flex items-center cursor-pointer hover:text-gray-700" onClick={() => sortData('method')}>
                Method
                <SortIcon column="method" />
              </div>
            </div>
          )}

          <div className="overflow-y-auto max-h-[590px]">
            {sortedPayments.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No payments recorded</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {sortedPayments.map((payment) => {
                  const isSelected = selectedPayment?.id === payment.id
                  return (
                    <li
                      key={payment.id}
                      onClick={async () => {
                        // Fetch full payment details including lessons
                        try {
                          const { data: fullPayment } = await api.get(`/payments/${payment.id}`)
                          setSelectedPayment(fullPayment)
                        } catch (error) {
                          console.error('Error fetching payment details:', error)
                          // Fallback to payment from list if API call fails
                          setSelectedPayment(payment)
                        }
                      }}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-100 border-l-4 border-indigo-700 pl-4 pr-4 py-3' : 'hover:bg-indigo-50 p-4 pl-[17px]'}`}
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-4">
                          <p className="text-sm font-medium text-gray-900">
                            {payment.student.firstName} {payment.student.lastName}
                          </p>
                        </div>
                        <div className="col-span-3">
                          <span className="text-sm text-gray-900">${parseFloat(payment.amount).toFixed(2)}</span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-sm text-gray-900">
                            {new Date(payment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-gray-700 capitalize">
                            {payment.method}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Packages List Panel - shown when showPackagesList is true */}
        {showPackagesList && (
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Packages</h2>
                <p className="text-sm text-gray-500 mt-1">{packages.length} {packages.length === 1 ? 'package' : 'packages'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPackagesList(false)}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Close packages"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[590px]">
              {packages.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No packages</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {packages.map((pkg) => {
                    const hoursRemaining = pkg.totalHours - pkg.hoursUsed
                    const isFullyUsed = hoursRemaining <= 0
                    const packageHourlyRate = pkg.price / pkg.totalHours
                    return (
                      <div 
                        key={pkg.id} 
                        className="p-4 hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-gray-900">{pkg.name}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                pkg.isActive 
                                  ? (isFullyUsed ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800')
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {pkg.isActive ? (isFullyUsed ? 'Used Up' : 'Active') : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {pkg.student.firstName} {pkg.student.lastName}
                            </p>
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">Hours:</span> {hoursRemaining.toFixed(2)} / {pkg.totalHours} remaining
                              </p>
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">Price:</span> ${pkg.price.toFixed(2)} 
                                <span className="text-gray-500 ml-1">(${packageHourlyRate.toFixed(2)}/hour)</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                Purchased: {new Date(pkg.purchasedAt).toLocaleDateString()}
                                {pkg.expiresAt && ` • Expires: ${new Date(pkg.expiresAt).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details Panel - only show when packages list is not shown */}
        {!showPackagesList && (
          <div className="bg-white rounded-lg shadow" style={{ height: '708px' }}>
          {selectedPayment ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedPayment.student.firstName} {selectedPayment.student.lastName}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Payment Details</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(selectedPayment)}
                      className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit payment"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this payment?')) {
                          handleDeleteDirect(selectedPayment.id)
                          setSelectedPayment(null)
                        }
                      }}
                      className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete payment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2.5 overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
                {/* Amount */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">${parseFloat(selectedPayment.amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{new Date(selectedPayment.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                </div>

                {/* Method */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</h3>
                  <div className="text-sm text-gray-700 capitalize">{selectedPayment.method}</div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</h3>
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-400 mt-0.5" />
                    <p className={`whitespace-pre-wrap ${selectedPayment.notes ? 'text-gray-900' : 'text-gray-400'}`}>
                      {selectedPayment.notes || '-'}
                    </p>
                  </div>
                </div>

                {/* Linked Lessons */}
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Linked Lessons</h3>
                    <button
                      onClick={async () => {
                        await fetchLessonsForStudent(selectedPayment.studentId)
                        setSelectedLessonId('')
                        setShowLinkLessonModal(true)
                      }}
                      className="px-2 py-1 text-xs font-medium rounded-md transition-colors bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                      title="Link a lesson to this payment"
                    >
                      Link Lesson
                    </button>
                  </div>
                  {selectedPayment.lessons && selectedPayment.lessons.length > 0 ? (
                    <div className="space-y-2">
                      {selectedPayment.lessons.map((lp) => {
                        const lesson = lp.lesson || lp; // Handle both new structure (lp.lesson) and old (direct lesson)
                        return (
                          <div key={lesson.id || lp.id} className="text-sm border border-gray-200 rounded p-2 bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {new Date(lesson.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  {lesson.subject && ` - ${lesson.subject}`}
                                </div>
                                <div className="text-xs text-gray-600 mt-0.5">
                                  ${lesson.price.toFixed(2)} • Paid from this payment: ${(lp.amount || lesson.paidAmount).toFixed(2)}
                                  {lesson.isPaid && <span className="ml-1 text-green-600">(Fully Paid)</span>}
                                </div>
                              </div>
                              <a
                                href="#lessons"
                                onClick={(e) => {
                                  e.preventDefault()
                                  window.location.href = '/lessons'
                                }}
                                className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                              >
                                View
                              </a>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      No lessons linked to this payment
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full p-8 text-center text-gray-500 text-sm">
              Select a payment to view details
            </div>
          )}
          </div>
        )}
      </div>

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
                          onChange={(e) => setFormData({ ...formData, studentId: e.target.value, applyToFamily: false })}
                          disabled={editingPayment}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
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

                    {/* Apply to Family - Only show if student has family members */}
                    {selectedStudentFamily.length > 0 && !editingPayment && (
                      <div className="flex items-start py-2">
                        <label className="w-32 text-sm text-gray-600 pt-2"></label>
                        <div className="flex-1">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.applyToFamily}
                              onChange={(e) => setFormData({ ...formData, applyToFamily: e.target.checked })}
                              className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <span className="text-sm text-gray-700 font-medium">Apply payment to entire family</span>
                              <div className="text-xs text-gray-500 mt-1">
                                This payment will be applied to all family members:
                                <ul className="list-disc list-inside mt-1 ml-2">
                                  <li>Selected student: {students.find(s => s.id === formData.studentId)?.firstName} {students.find(s => s.id === formData.studentId)?.lastName}</li>
                                  {selectedStudentFamily.map(member => (
                                    <li key={member.id}>{member.firstName} {member.lastName}</li>
                                  ))}
                                </ul>
                                <span className="block mt-1 text-gray-600">
                                  Each family member will receive a payment of ${formData.amount || '0.00'} applied to their lessons.
                                </span>
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

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
                          readOnly={editingPayment && (editingPayment.packageId || (editingPayment.notes && editingPayment.notes.startsWith('Package: ')))}
                          className={`w-32 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm ${
                            editingPayment && (editingPayment.packageId || (editingPayment.notes && editingPayment.notes.startsWith('Package: '))) 
                              ? 'bg-gray-50 text-gray-600 cursor-not-allowed' 
                              : ''
                          }`}
                          placeholder="0.00"
                        />
                        {editingPayment && (editingPayment.packageId || (editingPayment.notes && editingPayment.notes.startsWith('Package: '))) && (
                          <span className="text-xs text-gray-500 ml-2">(Cannot change package payment amount)</span>
                        )}
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
                          placeholder="Optional notes... (Use 'Package: Package Name' for package payments)"
                        />
                        {formData.notes && formData.notes.trim().startsWith('Package: ') && formData.studentId && (() => {
                          const student = students.find(s => s.id === formData.studentId)
                          if (!student) return null
                          
                          const isValid = student.usePackages && student.pricePerPackage
                          const amountMatches = student.pricePerPackage && Math.abs(parseFloat(formData.amount || 0) - parseFloat(student.pricePerPackage)) <= 0.01
                          
                          return (
                            <div className="mt-2 space-y-1">
                              {!student.usePackages && (
                                <p className="text-xs text-red-600">⚠️ This student does not use packages</p>
                              )}
                              {student.usePackages && !student.pricePerPackage && (
                                <p className="text-xs text-red-600">⚠️ Package price not set for this student</p>
                              )}
                              {isValid && !amountMatches && (
                                <p className="text-xs text-red-600">
                                  ⚠️ Amount must match package price: ${parseFloat(student.pricePerPackage).toFixed(2)}
                                </p>
                              )}
                              {isValid && amountMatches && (
                                <p className="text-xs text-green-600">✓ Valid package payment</p>
                              )}
                            </div>
                          )
                        })()}
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
                      onClick={() => { 
                        if (!isSubmitting) {
                          setShowModal(false)
                          resetForm()
                        }
                      }}
                      disabled={isSubmitting}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Package Modal */}
      {showPackageModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmitPackage}>
                <div className="bg-white px-6 pt-5 pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingPackage ? 'Edit Package' : 'Add Package'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setShowPackageModal(false); resetPackageForm(); }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {!editingPackage && (
                      <>
                        {/* Student */}
                        <div className="flex items-start py-2">
                          <label className="w-32 text-sm text-gray-600 pt-2">Student</label>
                          <div className="flex-1">
                            <select
                              required
                              disabled={isSubmittingPackage}
                              value={packageForm.studentId}
                              onChange={(e) => {
                                const selectedStudent = students.find(s => s.id === e.target.value)
                                setPackageForm({ 
                                  ...packageForm, 
                                  studentId: e.target.value,
                                  // Prefill totalHours and price when student is selected
                                  totalHours: selectedStudent ? 10 : packageForm.totalHours,
                                  price: selectedStudent?.pricePerPackage || packageForm.price
                                })
                              }}
                              className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="">Select student</option>
                              {students.filter(s => !s.archived && s.usePackages).map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.firstName} {s.lastName}
                                  {s.pricePerPackage ? ` ($${parseFloat(s.pricePerPackage).toFixed(2)})` : ''}
                                </option>
                              ))}
                            </select>
                            {students.filter(s => !s.archived && s.usePackages).length === 0 && (
                              <p className="text-xs text-gray-500 mt-1">No students with packages enabled</p>
                            )}
                          </div>
                        </div>

                        {/* Package Name */}
                        <div className="flex items-start py-2">
                          <label className="w-32 text-sm text-gray-600 pt-2">Name</label>
                          <input
                            type="text"
                            required
                            disabled={isSubmittingPackage}
                            value={packageForm.name}
                            onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                            className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="e.g., 10-Hour Package"
                          />
                        </div>

                        {/* Total Hours - Read-only, pre-filled */}
                        <div className="flex items-start py-2">
                          <label className="w-32 text-sm text-gray-600 pt-2">Hours</label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            value={packageForm.totalHours}
                            readOnly
                            className="w-32 border-0 border-b border-gray-300 bg-gray-50 px-0 py-1.5 text-sm text-gray-600 cursor-not-allowed"
                            placeholder="10"
                          />
                          <span className="text-xs text-gray-500 ml-2 pt-1.5">(Auto-filled from student settings)</span>
                        </div>

                        {/* Price - Read-only, pre-filled */}
                        <div className="flex items-start py-2">
                          <label className="w-32 text-sm text-gray-600 pt-2">Price</label>
                          <div className="flex-1 flex items-center gap-1">
                            <span className="text-sm text-gray-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={packageForm.price}
                              readOnly
                              className="w-32 border-0 border-b border-gray-300 bg-gray-50 px-0 py-1.5 text-sm text-gray-600 cursor-not-allowed"
                              placeholder="0.00"
                            />
                            <span className="text-xs text-gray-500 ml-2">(Auto-filled from student's package price)</span>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {editingPackage && (
                      <>
                        {/* Read-only fields when editing */}
                        <div className="flex items-start py-2">
                          <label className="w-32 text-sm text-gray-600 pt-2">Student</label>
                          <div className="flex-1 pt-1.5 text-sm text-gray-900">
                            {editingPackage.student.firstName} {editingPackage.student.lastName}
                          </div>
                        </div>
                        <div className="flex items-start py-2">
                          <label className="w-32 text-sm text-gray-600 pt-2">Name</label>
                          <div className="flex-1 pt-1.5 text-sm text-gray-900">
                            {editingPackage.name}
                          </div>
                        </div>
                        <div className="flex items-start py-2">
                          <label className="w-32 text-sm text-gray-600 pt-2">Hours</label>
                          <div className="flex-1 pt-1.5 text-sm text-gray-900">
                            {editingPackage.totalHours}
                          </div>
                        </div>
                        <div className="flex items-start py-2">
                          <label className="w-32 text-sm text-gray-600 pt-2">Price</label>
                          <div className="flex-1 pt-1.5 text-sm text-gray-900">
                            ${editingPackage.price.toFixed(2)}
                          </div>
                        </div>
                      </>
                    )}

                    {!editingPackage && (
                      <div className="flex items-start py-2">
                        <label className="w-32 text-sm text-gray-600 pt-2">Method</label>
                        <div className="flex-1">
                          <select
                            required
                            disabled={isSubmittingPackage}
                            value={packageForm.method}
                            onChange={(e) => setPackageForm({ ...packageForm, method: e.target.value })}
                            className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="venmo">Venmo</option>
                            <option value="zelle">Zelle</option>
                            <option value="cash">Cash</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Purchased At */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Purchased</label>
                      <input
                        type="date"
                        required
                        disabled={isSubmittingPackage}
                        value={packageForm.purchasedAt}
                        onChange={(e) => setPackageForm({ ...packageForm, purchasedAt: e.target.value })}
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Expires At */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Expires</label>
                      <input
                        type="date"
                        disabled={isSubmittingPackage}
                        value={packageForm.expiresAt}
                        onChange={(e) => setPackageForm({ ...packageForm, expiresAt: e.target.value })}
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowPackageModal(false); resetPackageForm(); }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPackage}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingPackage ? 'Creating...' : editingPackage ? 'Save Package' : 'Create Package'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Link Lesson Modal */}
      {showLinkLessonModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Link Lesson to Payment</h3>
                <button
                  onClick={() => {
                    setShowLinkLessonModal(false)
                    setSelectedLessonId('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Lesson
                  </label>
                  <select
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- Select a lesson --</option>
                    {availableLessons
                      .filter(lesson => lesson.status !== 'cancelled' && lesson.status !== 'canceled')
                      .map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {new Date(lesson.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {lesson.subject ? ` - ${lesson.subject}` : ''}
                          {' - $'}{lesson.price.toFixed(2)}
                          {lesson.isPaid && ' (Already Paid)'}
                        </option>
                      ))}
                  </select>
                  {availableLessons.filter(l => l.status !== 'cancelled' && l.status !== 'canceled').length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">No lessons found for this student</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => {
                      setShowLinkLessonModal(false)
                      setSelectedLessonId('')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedLessonId) {
                        toast.error('Please select a lesson')
                        return
                      }
                      try {
                        const { data: updatedPayment } = await api.patch(`/payments/${selectedPayment.id}/link-lesson`, {
                          lessonId: selectedLessonId
                        })
                        setSelectedPayment(updatedPayment)
                        await fetchPayments()
                        setShowLinkLessonModal(false)
                        setSelectedLessonId('')
                        toast.success('Lesson linked to payment successfully')
                      } catch (error) {
                        console.error('Error linking lesson:', error)
                        toast.error(error.response?.data?.message || 'Failed to link lesson to payment')
                      }
                    }}
                    disabled={!selectedLessonId}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Link Lesson
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

