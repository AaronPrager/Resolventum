import { useEffect, useState, useRef } from 'react'
import { api } from '../utils/api'
import { DollarSign, BookOpen, AlertCircle, Users as UsersIcon, Calendar as CalendarIcon, FileText, Download } from 'lucide-react'
import toast from 'react-hot-toast'

export function Reports() {
  const [summary, setSummary] = useState({
    totalIncome: 0,
    lessonsCompleted: 0,
    outstandingBalances: 0,
    totalStudents: 0,
  })
  const [outstanding, setOutstanding] = useState([])
  const [recentPayments, setRecentPayments] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState('outstanding') // 'outstanding'|'monthlyAll'|'packages'|'lessonsPayments'
  const [packagesReport, setPackagesReport] = useState({ packages: [], summary: {} })
  const [packagesFilter, setPackagesFilter] = useState('all') // 'all', 'active', 'inactive'
  const [selectedPackageId, setSelectedPackageId] = useState(null)
  const [packageLessons, setPackageLessons] = useState([])
  const now = new Date()
  const [lessonsPaymentsReport, setLessonsPaymentsReport] = useState(null)
  const [lessonsPaymentsMonth, setLessonsPaymentsMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [lessonsPaymentsYear, setLessonsPaymentsYear] = useState(String(now.getFullYear()))
  const [lessonsPaymentsStudent, setLessonsPaymentsStudent] = useState('')
  const [lessonsPaymentsShowAllTime, setLessonsPaymentsShowAllTime] = useState(false)
  const [linkingLessonId, setLinkingLessonId] = useState(null)
  const [availablePayments, setAvailablePayments] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [showCreatePaymentModal, setShowCreatePaymentModal] = useState(false)
  const [creatingPaymentForLesson, setCreatingPaymentForLesson] = useState(null)
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [newPaymentForm, setNewPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'venmo',
    notes: ''
  })
  const [openDropdown, setOpenDropdown] = useState(null) // Track which dropdown is open: lessonId or lessonId-paymentId
  const [sortColumn, setSortColumn] = useState('date') // 'date' or 'name'
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'

  // Student monthly report state
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [studentMonthly, setStudentMonthly] = useState({ lessons: [], payments: [] })
  const [loadingStudentMonthly, setLoadingStudentMonthly] = useState(false)

  // Monthly all students report state
  const [monthlyAllReport, setMonthlyAllReport] = useState(null)
  const [loadingMonthlyAll, setLoadingMonthlyAll] = useState(false)
  const [monthlyAllMonth, setMonthlyAllMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [monthlyAllYear, setMonthlyAllYear] = useState(String(now.getFullYear()))
  const [monthlyAllStudentId, setMonthlyAllStudentId] = useState('')
  const [monthlyAllFamilyId, setMonthlyAllFamilyId] = useState('')
  const [families, setFamilies] = useState([])
  const [monthlyAllDateRangeMode, setMonthlyAllDateRangeMode] = useState('month') // 'month' or 'range'
  const [monthlyAllStartDate, setMonthlyAllStartDate] = useState('')
  const [monthlyAllEndDate, setMonthlyAllEndDate] = useState('')

  const fetchData = async () => {
    try {
      const [summaryRes, outstandingRes, paymentsRes, allPaymentsRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/reports/outstanding'),
        api.get('/reports/payments/recent'),
        api.get('/payments'),
      ])

      setSummary({
        totalIncome: summaryRes.data?.totalIncome ?? 0,
        lessonsCompleted: summaryRes.data?.lessonsCompleted ?? 0,
        outstandingBalances: summaryRes.data?.outstandingBalances ?? 0,
        totalStudents: summaryRes.data?.totalStudents ?? 0,
      })
      setOutstanding(outstandingRes.data || [])
      setRecentPayments((paymentsRes.data || []).slice(0, 10))
      setAllPayments(allPaymentsRes.data || [])
    } catch (err) {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }


  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students')
      setStudents(data)
    } catch (err) {
      // ignore
    }
  }

  const fetchFamilies = async () => {
    try {
      const { data } = await api.get('/students/families')
      setFamilies(data)
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    fetchData()
    fetchStudents()
    fetchFamilies()

    const interval = setInterval(fetchData, 60 * 1000)
    const onFocus = () => fetchData()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Auto-load packages report when packages report is active
  useEffect(() => {
    if (activeReport === 'packages') {
      const loadPackages = async () => {
        try {
          const { data } = await api.get('/reports/packages', { params: { status: packagesFilter } })
          console.log('Packages report data loaded:', data)
          if (data && data.packages) {
            setPackagesReport(data)
          } else {
            console.error('Invalid packages report data structure:', data)
            setPackagesReport({ packages: [], summary: {} })
          }
        } catch (error) {
          console.error('Failed to load packages report:', error)
          toast.error(error.response?.data?.message || 'Failed to load packages report')
        }
      }
      loadPackages()
    }
  }, [activeReport, packagesFilter])

  // Load lessons payments report
  const loadLessonsPaymentsReport = async () => {
    try {
      // Add a small delay to ensure backend has processed all changes
      await new Promise(resolve => setTimeout(resolve, 300))
      const params = {}
      if (!lessonsPaymentsShowAllTime) {
        params.month = lessonsPaymentsMonth
        params.year = lessonsPaymentsYear
      }
      if (lessonsPaymentsStudent) {
        params.studentId = lessonsPaymentsStudent
      }
      const { data } = await api.get('/reports/lessons-payments', { params })
      // Ensure we don't have duplicate lessons (by ID) - merge payments if duplicates exist
      if (data && data.lessons) {
        const originalCount = data.lessons.length
        const lessonMap = new Map()
        const lessonIdsSeen = new Set()
        const duplicateLessons = []
        
        data.lessons.forEach(lesson => {
          if (!lesson.id) {
            console.warn('Lesson without ID found:', lesson)
            return // Skip lessons without IDs
          }
          
          // Check for duplicates by ID
          if (lessonIdsSeen.has(lesson.id)) {
            duplicateLessons.push(lesson)
          }
          lessonIdsSeen.add(lesson.id)
          
          if (!lessonMap.has(lesson.id)) {
            lessonMap.set(lesson.id, { ...lesson })
          } else {
            // If duplicate found, merge payments
            const existing = lessonMap.get(lesson.id)
            console.log(`[Frontend] Duplicate lesson ID found: ${lesson.id}`, {
              existing: { price: existing.price, paidAmount: existing.paidAmount, payments: existing.payments.length },
              duplicate: { price: lesson.price, paidAmount: lesson.paidAmount, payments: lesson.payments.length }
            })
            
            const existingPaymentIds = new Set((existing.payments || []).map(p => p.id))
            // Merge payments that aren't already in the existing lesson
            if (lesson.payments && lesson.payments.length > 0) {
              lesson.payments.forEach(p => {
                if (p.id && !existingPaymentIds.has(p.id)) {
                  existing.payments.push(p)
                }
              })
            }
            // Update paidAmount to the maximum (should be the same, but take max to be safe)
            existing.paidAmount = Math.max(existing.paidAmount || 0, lesson.paidAmount || 0)
            // Update price to the maximum (should be the same)
            existing.price = Math.max(existing.price || 0, lesson.price || 0)
          }
        })
        
        const uniqueCount = lessonMap.size
        let uniqueLessonsArray = Array.from(lessonMap.values())
        
        // Also check for logical duplicates (same studentId, date, price but different IDs)
        const logicalDuplicates = []
        const seenLogical = new Map() // key: studentId-date-price
        const finalLessons = []
        
        uniqueLessonsArray.forEach(lesson => {
          // Round price to 2 decimal places to avoid floating point comparison issues
          const priceRounded = Math.round((lesson.price || 0) * 100) / 100
          const logicalKey = `${lesson.studentId}-${lesson.date}-${priceRounded}`
          
          if (seenLogical.has(logicalKey)) {
            const existing = seenLogical.get(logicalKey)
            logicalDuplicates.push({ existing, duplicate: lesson })
            console.log(`[Frontend] Found logical duplicate (same student, date, price):`, {
              existing: { id: existing.id, name: existing.name, date: existing.date, price: existing.price, payments: existing.payments.length },
              duplicate: { id: lesson.id, name: lesson.name, date: lesson.date, price: lesson.price, payments: lesson.payments.length },
              logicalKey: logicalKey
            })
            // Merge payments from the duplicate into the existing
            const existingPaymentIds = new Set((existing.payments || []).map(p => p.id))
            if (lesson.payments && lesson.payments.length > 0) {
              lesson.payments.forEach(p => {
                if (p.id && !existingPaymentIds.has(p.id)) {
                  existing.payments.push(p)
                }
              })
            }
            existing.paidAmount = Math.max(existing.paidAmount || 0, lesson.paidAmount || 0)
            existing.price = Math.max(existing.price || 0, lesson.price || 0)
          } else {
            seenLogical.set(logicalKey, lesson)
            finalLessons.push(lesson)
          }
        })
        
        if (logicalDuplicates.length > 0) {
          console.warn(`[Frontend] Found ${logicalDuplicates.length} logical duplicate lesson(s) (same student, date, price), merged.`, {
            duplicates: logicalDuplicates.map(d => ({
              existingId: d.existing.id,
              duplicateId: d.duplicate.id,
              name: d.existing.name,
              date: d.existing.date,
              price: d.existing.price
            }))
          })
          uniqueLessonsArray = finalLessons
        }
        
        data.lessons = uniqueLessonsArray
        
        // Always log lesson count for debugging
        console.log(`[Frontend] Lessons report: ${originalCount} total, ${uniqueCount} unique by ID, ${uniqueLessonsArray.length} unique after logical deduplication`)
        
        // Log if duplicates were found (for debugging)
        if (originalCount !== uniqueCount || duplicateLessons.length > 0) {
          console.warn(`[Frontend] Found ${originalCount - uniqueCount} duplicate lesson(s) in report, deduplicated.`, {
            duplicateLessons: duplicateLessons.map(l => ({ id: l.id, name: l.name, date: l.date, price: l.price }))
          })
        }
        
        // Log all lesson IDs to help debug
        console.log(`[Frontend] All lesson IDs:`, data.lessons.map(l => l.id))
        
        // Debug: Check for Daniel Khotline on Sep 12
        const danielLessons = data.lessons.filter(l => 
          l.name.includes('Khotline') && l.date === '09/12/2025'
        )
        if (danielLessons.length > 0) {
          console.log(`[Frontend] Daniel Khotline lessons on 09/12/2025:`, danielLessons.map(l => ({
            id: l.id,
            name: l.name,
            date: l.date,
            price: l.price,
            payments: l.payments.length,
            paymentIds: l.payments.map(p => p.id),
            paymentDetails: l.payments.map(p => ({ id: p.id, amount: p.amount, date: p.date }))
          })))
          
          // Check if there are duplicate IDs
          const danielIds = danielLessons.map(l => l.id)
          const uniqueDanielIds = new Set(danielIds)
          if (danielIds.length !== uniqueDanielIds.size) {
            console.error(`[Frontend] DUPLICATE LESSON IDS FOUND for Daniel Khotline:`, danielIds)
          }
        }
        
        // Check entire lessons array for duplicate IDs
        const allIds = data.lessons.map(l => l.id)
        const uniqueIds = new Set(allIds)
        if (allIds.length !== uniqueIds.size) {
          const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index)
          console.error(`[Frontend] DUPLICATE LESSON IDS IN ARRAY:`, duplicateIds)
          console.error(`[Frontend] Total lessons: ${allIds.length}, Unique IDs: ${uniqueIds.size}`)
        }
      }
      setLessonsPaymentsReport(data)
    } catch (error) {
      console.error('Failed to load lessons payments report:', error)
      toast.error(error.response?.data?.message || 'Failed to load lessons payments report')
    }
  }

  // Fetch available payments for a student that can be linked to a lesson
  const fetchAvailablePayments = async (studentId, lessonId, unlinkExisting = false) => {
    try {
      setLoadingPayments(true)
      
      // If unlinkExisting is true, unlink all existing payments first
      if (unlinkExisting) {
        // Get the lesson to find all linked payments
        const { data: lessonData } = await api.get(`/lessons/${lessonId}`)
        if (lessonData && lessonData.payments) {
          // Unlink all payments
          for (const lessonPayment of lessonData.payments) {
            try {
              await api.patch(`/lessons/${lessonId}/unlink-payment`, { 
                paymentId: lessonPayment.payment.id 
              })
            } catch (err) {
              console.error('Failed to unlink payment:', err)
            }
          }
        }
      }
      
      // Get current lesson to see what payments are already linked and get student's familyId
      const { data: lessonData } = await api.get(`/lessons/${lessonId}`)
      const alreadyLinkedPaymentIds = new Set(
        (lessonData?.payments || []).map(lp => lp.payment.id)
      )
      
      // Get student's familyId if available
      const studentFamilyId = lessonData?.student?.familyId
      
      // Fetch individual payments for this student
      const { data: individualPayments } = await api.get('/payments', { 
        params: { studentId } 
      })
      
      // Also fetch family payments if student has a family
      let familyPayments = []
      if (studentFamilyId) {
        try {
          const { data: familyPaymentsData } = await api.get('/payments', {
            params: { familyId: studentFamilyId }
          })
          familyPayments = familyPaymentsData || []
        } catch (err) {
          console.error('Failed to fetch family payments:', err)
        }
      }
      
      // Combine individual and family payments, removing duplicates
      const allPayments = [...(individualPayments || [])]
      const existingPaymentIds = new Set(allPayments.map(p => p.id))
      familyPayments.forEach(payment => {
        if (!existingPaymentIds.has(payment.id)) {
          allPayments.push(payment)
          existingPaymentIds.add(payment.id)
        }
      })
      
      // Filter out payments that are already fully linked to this lesson
      // But still show payments that could be partially applied
      const availablePayments = allPayments.filter(payment => {
        // Show payments that aren't linked yet, or could have more applied
        return !alreadyLinkedPaymentIds.has(payment.id)
      })
      
      setAvailablePayments(availablePayments)
      setLinkingLessonId(lessonId)
    } catch (error) {
      console.error('Failed to load available payments:', error)
      toast.error('Failed to load available payments')
    } finally {
      setLoadingPayments(false)
    }
  }

  // Link a payment to a lesson (allows multiple payments per lesson)
  const handleLinkPayment = async (lessonId, paymentId, keepOpen = false) => {
    try {
      // Check if this payment is already linked to this lesson
      const { data: currentLesson } = await api.get(`/lessons/${lessonId}`)
      const alreadyLinked = currentLesson?.payments?.some(lp => lp.payment.id === paymentId)
      
      if (alreadyLinked) {
        toast.success('Payment already linked to this lesson')
        if (keepOpen) {
          await fetchAvailablePayments(lessonsPaymentsReport.lessons.find(l => l.id === lessonId)?.studentId, lessonId, false)
          await loadLessonsPaymentsReport()
        }
        return
      }
      
      // Allow payment to be linked to multiple lessons (e.g., $200 payment can cover 2 $100 lessons)
      // No need to unlink from other lessons - the backend will handle amount allocation
      
      // Link the payment to the intended lesson
      await api.patch(`/lessons/${lessonId}/link-payment`, { paymentId })
      
      // Wait a bit to ensure linking is processed before reloading
      await new Promise(resolve => setTimeout(resolve, 300))
      
      toast.success('Payment linked to lesson')
      
      if (keepOpen) {
        // Keep dropdown open and refresh available payments
        await fetchAvailablePayments(lessonsPaymentsReport.lessons.find(l => l.id === lessonId)?.studentId, lessonId, false)
        // Reload the report to show updated data
        await loadLessonsPaymentsReport()
      } else {
        setLinkingLessonId(null)
        setAvailablePayments([])
        // Reload the report to show updated data
        await loadLessonsPaymentsReport()
      }
    } catch (error) {
      console.error('Failed to link payment:', error)
      toast.error(error.response?.data?.message || 'Failed to link payment to lesson')
    }
  }

  // Unlink a payment from a lesson
  const handleUnlinkPayment = async (lessonId, paymentId) => {
    try {
      await api.patch(`/lessons/${lessonId}/unlink-payment`, { paymentId })
      toast.success('Payment unlinked from lesson')
      // Reload the report to show updated data
      await loadLessonsPaymentsReport()
    } catch (error) {
      console.error('Failed to unlink payment:', error)
      toast.error(error.response?.data?.message || 'Failed to unlink payment from lesson')
    }
  }

  // Mark lesson as paid/unpaid without payment record
  const handleMarkPaidStatus = async (lessonId, isPaid) => {
    try {
      await api.patch(`/lessons/${lessonId}/payment-status`, { isPaid })
      toast.success(isPaid ? 'Lesson marked as paid' : 'Lesson marked as unpaid')
      // Reload the report to show updated data
      await loadLessonsPaymentsReport()
    } catch (error) {
      console.error('Failed to update payment status:', error)
      toast.error(error.response?.data?.message || 'Failed to update payment status')
    }
  }

  // Mark lesson as Complimentary: unlink all payments, set price to 0, and mark as paid
  const handleMarkAsComplimentary = async (lesson) => {
    try {
      // First, fetch the full lesson to get dateTime and other required fields
      const { data: fullLesson } = await api.get(`/lessons/${lesson.id}`)
      
      // Unlink all existing payments
      if (lesson.payments && lesson.payments.length > 0) {
        for (const payment of lesson.payments) {
          await api.patch(`/lessons/${lesson.id}/unlink-payment`, { paymentId: payment.id })
        }
      }
      
      // Update lesson: set price to 0 and mark as paid (complimentary)
      // Use PUT endpoint to update price, which requires dateTime
      const dateTime = new Date(fullLesson.dateTime)
      await api.put(`/lessons/${lesson.id}`, {
        dateTime: dateTime.toISOString(),
        price: 0,
        studentId: fullLesson.studentId,
        duration: fullLesson.duration || 60,
        subject: fullLesson.subject || '',
        notes: fullLesson.notes || null,
        status: fullLesson.status || 'scheduled'
      })
      
      // Then mark as paid (complimentary)
      await api.patch(`/lessons/${lesson.id}/payment-status`, { isPaid: true })
      
      toast.success('Lesson marked as Complimentary')
      // Reload the report to show updated data
      await loadLessonsPaymentsReport()
    } catch (error) {
      console.error('Failed to mark as complimentary:', error)
      toast.error(error.response?.data?.message || 'Failed to mark lesson as complimentary')
    }
  }

  // Delete a payment
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
      return
    }
    try {
      await api.delete(`/payments/${paymentId}`)
      toast.success('Payment deleted')
      // Reload the report to show updated data
      await loadLessonsPaymentsReport()
    } catch (error) {
      console.error('Failed to delete payment:', error)
      toast.error(error.response?.data?.message || 'Failed to delete payment')
    }
  }

  // Create a new payment and link it to a lesson
  const handleCreatePayment = async (lesson) => {
    try {
      setIsCreatingPayment(true) // Disable buttons at start
      
      const [year, month, day] = newPaymentForm.date.split('-').map(Number)
      const localDate = new Date(year, month - 1, day, 0, 0, 0, 0)
      
      const paymentData = {
        studentId: lesson.studentId,
        amount: parseFloat(newPaymentForm.amount),
        method: newPaymentForm.method,
        date: localDate.toISOString(),
        notes: newPaymentForm.notes || null
      }

      const { data: newPayment } = await api.post('/payments', paymentData)
      toast.success('Payment created')
      
      // Wait a moment to ensure payment is committed to database
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Get the full payment to check if it was auto-applied to any lessons
      const { data: paymentWithLessons } = await api.get(`/payments/${newPayment.id}`)
      
      // Check if payment is already linked to the target lesson
      const alreadyLinkedToTarget = paymentWithLessons?.lessons?.some(
        lp => lp.lesson && lp.lesson.id === lesson.id
      )
      
      if (alreadyLinkedToTarget) {
        // Payment was auto-applied to the target lesson - just unlink from other lessons if any
        if (paymentWithLessons && paymentWithLessons.lessons && paymentWithLessons.lessons.length > 0) {
          const unlinkPromises = []
          for (const lessonPayment of paymentWithLessons.lessons) {
            if (lessonPayment.lesson && lessonPayment.lesson.id !== lesson.id) {
              // Unlink from other lessons
              unlinkPromises.push(
                api.patch(`/lessons/${lessonPayment.lesson.id}/unlink-payment`, { paymentId: newPayment.id })
                  .catch(unlinkError => {
                    console.error('Failed to unlink auto-applied payment:', unlinkError)
                  })
              )
            }
          }
          await Promise.all(unlinkPromises)
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        toast.success('Payment created and linked to lesson')
      } else {
        // Payment was auto-applied to other lessons or not applied - unlink from others and link to target
        if (paymentWithLessons && paymentWithLessons.lessons && paymentWithLessons.lessons.length > 0) {
          const unlinkPromises = []
          for (const lessonPayment of paymentWithLessons.lessons) {
            if (lessonPayment.lesson && lessonPayment.lesson.id !== lesson.id) {
              // Unlink from other lessons
              unlinkPromises.push(
                api.patch(`/lessons/${lessonPayment.lesson.id}/unlink-payment`, { paymentId: newPayment.id })
                  .catch(unlinkError => {
                    console.error('Failed to unlink auto-applied payment:', unlinkError)
                  })
              )
            }
          }
          await Promise.all(unlinkPromises)
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        
        // Now link the payment to the intended lesson
        try {
          const { data: linkedLesson } = await api.patch(`/lessons/${lesson.id}/link-payment`, { paymentId: newPayment.id })
          
          // Verify the link was successful
          if (linkedLesson && linkedLesson.payments && linkedLesson.payments.some(lp => lp.payment.id === newPayment.id)) {
            toast.success('Payment linked to lesson')
          } else {
            console.warn('Link payment response does not include the payment:', linkedLesson)
            toast.success('Payment created, but linking may need verification')
          }
        } catch (linkError) {
          console.error('Failed to link payment:', linkError)
          toast.error(linkError.response?.data?.message || 'Payment created but failed to link. Please link manually.')
        }
      }
      
      // Reset form and close modal
      setNewPaymentForm({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        method: 'venmo',
        notes: ''
      })
      setShowCreatePaymentModal(false)
      setCreatingPaymentForLesson(null)
      
      // Reload the report to show updated data
      await loadLessonsPaymentsReport()
    } catch (error) {
      console.error('Failed to create payment:', error)
      toast.error(error.response?.data?.message || 'Failed to create payment')
    } finally {
      setIsCreatingPayment(false) // Re-enable buttons when done
    }
  }

  useEffect(() => {
    if (activeReport === 'lessonsPayments') {
      loadLessonsPaymentsReport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, lessonsPaymentsMonth, lessonsPaymentsYear, lessonsPaymentsStudent, lessonsPaymentsShowAllTime])

  const formatCurrency = (amount) => {
    const num = Number(amount) || 0
    return `$${num.toFixed(2)}`
  }

  const loadStudentMonthly = async () => {
    if (!selectedStudentId) {
      toast.error('Select a student')
      return
    }
    try {
      setLoadingStudentMonthly(true)
      const res = await api.get('/reports/monthly', {
        params: { month: Number(month), year: Number(year), studentId: selectedStudentId },
      })
      const lessons = res.data?.lessons || []
      const payments = res.data?.payments || []
      setStudentMonthly({ lessons, payments })
    } catch (err) {
      toast.error('Failed to load student monthly report')
    } finally {
      setLoadingStudentMonthly(false)
    }
  }

  const loadMonthlyAll = async () => {
    try {
      setLoadingMonthlyAll(true)
      const params = {}
      
      if (monthlyAllDateRangeMode === 'month') {
        // Use month/year if month mode is selected
        if (monthlyAllMonth && monthlyAllYear) {
          params.month = Number(monthlyAllMonth)
          params.year = Number(monthlyAllYear)
        } else {
          toast.error('Please select both month and year')
          return
        }
      } else {
        // Use date range if range mode is selected
        if (monthlyAllStartDate && monthlyAllEndDate) {
          // Create dates at local midnight to avoid timezone issues
          const startDate = new Date(monthlyAllStartDate + 'T00:00:00')
          const endDate = new Date(monthlyAllEndDate + 'T23:59:59')
          params.startDate = startDate.toISOString()
          params.endDate = endDate.toISOString()
        } else {
          toast.error('Please select both start and end dates')
          return
        }
      }
      
      if (monthlyAllFamilyId) {
        params.familyId = monthlyAllFamilyId
      } else if (monthlyAllStudentId) {
        params.studentId = monthlyAllStudentId
      }
      
      const res = await api.get('/reports/monthly-all', { params })
      setMonthlyAllReport(res.data)
    } catch (err) {
      toast.error('Failed to load monthly report for all students')
      console.error(err)
    } finally {
      setLoadingMonthlyAll(false)
    }
  }

  const totalBilledForStudent = studentMonthly.lessons
    .reduce((sum, l) => sum + (l.price || 0), 0)
  const totalPaidForStudent = studentMonthly.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const balanceForStudent = totalBilledForStudent - totalPaidForStudent

  const handleGenerateInvoice = async () => {
    if (!selectedStudentId) return
    try {
      const response = await api.post(
        `/invoices/generate/${selectedStudentId}`,
        { month: Number(month), year: Number(year) },
        { responseType: 'blob' }
      )
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice-${month}-${year}.pdf`)
      document.body.appendChild(link)
      link.click()
      toast.success('Invoice generated')
    } catch (err) {
      toast.error('Failed to generate invoice')
    }
  }

  // Aggregation: totals per month with method breakdown
  const monthlyPaymentTotals = (() => {
    const map = new Map()
    for (const p of allPayments) {
      const d = new Date(p.date)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const prev = map.get(key) || { total: 0, venmo: 0, zelle: 0, cash: 0, other: 0 }
      const amount = Number(p.amount) || 0
      prev.total += amount
      const method = (p.method || 'other').toLowerCase()
      if (method === 'venmo' || method === 'zelle' || method === 'cash' || method === 'other') {
        prev[method] += amount
      } else {
        prev.other += amount
      }
      map.set(key, prev)
    }
    // Sort by month desc
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([monthKey, vals]) => ({ monthKey, ...vals }))
  })()

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Reports Area: Left menu + Right content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Menu */}
        <div className="bg-white rounded-lg shadow p-3 h-fit">
          <p className="text-sm font-semibold text-gray-700 px-2 mb-2">Financial & Payment Reports</p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setActiveReport('outstanding')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'outstanding' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Outstanding Balances
              </button>
            </li>
            <li>
              <button
                onClick={async () => {
                  setActiveReport('packages')
                  try {
                    const { data } = await api.get('/reports/packages', { params: { status: packagesFilter } })
                    console.log('Packages report data:', data)
                    if (data && data.packages) {
                      setPackagesReport(data)
                    } else {
                      console.error('Invalid packages report data structure:', data)
                      setPackagesReport({ packages: [], summary: {} })
                      toast.error('Invalid packages report data received')
                    }
                  } catch (error) {
                    console.error('Failed to load packages report:', error)
                    toast.error(error.response?.data?.message || 'Failed to load packages report')
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'packages' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Package Tracking
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveReport('lessonsPayments')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'lessonsPayments' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Lessons & Payments
              </button>
            </li>
          </ul>
          <p className="text-sm font-semibold text-gray-700 px-2 mt-4 mb-2">Student Statements</p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => {
                  setActiveReport('monthlyAll')
                  loadMonthlyAll()
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'monthlyAll' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Monthly Report (All Students)
              </button>
            </li>
          </ul>
        </div>

        {/* Right Content (single active report) */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow overflow-hidden">
          {activeReport === 'outstanding' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Outstanding Balances Report</h2>
                  <p className="text-sm text-gray-500">
                    Shows which students/families owe money and how much.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student/Family
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lessons Completed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Billed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Payment Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {outstanding.length === 0 ? (
                      <tr>
                          <td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-500">No outstanding balances</td>
                      </tr>
                    ) : (
                      outstanding.map((row) => (
                          <tr key={row.familyId || row.studentId}>
                          <td className="px-6 py-3 whitespace-nowrap text-gray-900">
                            {row.familyName || row.studentName}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">{row.lessonsCompleted ?? 0}</td>
                          <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.totalBilled)}</td>
                          <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.paid)}</td>
                            <td className={`px-6 py-3 whitespace-nowrap font-semibold ${Number(row.balanceDue) > 0 ? 'text-red-600' : ''}`}>{formatCurrency(row.balanceDue)}</td>
                          <td className="px-6 py-3 whitespace-nowrap">{row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === 'monthlyAll' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Monthly Report - All Students</h2>
                  <p className="text-sm text-gray-500">
                    {monthlyAllFamilyId 
                      ? `Lessons, payments, and balances for the selected family${monthlyAllDateRangeMode === 'month' ? ' in the selected month' : ' in the selected date range'}.`
                      : monthlyAllStudentId 
                      ? `Lessons, payments, and balances for the selected student${monthlyAllDateRangeMode === 'month' ? ' in the selected month' : ' in the selected date range'}.`
                      : `Lessons, payments, and balances for all students${monthlyAllDateRangeMode === 'month' ? ' in the selected month' : ' in the selected date range'}.`}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Filter by:</label>
                    <select
                      value={monthlyAllDateRangeMode}
                      onChange={(e) => {
                        setMonthlyAllDateRangeMode(e.target.value)
                        // Clear dates when switching modes
                        setMonthlyAllStartDate('')
                        setMonthlyAllEndDate('')
                      }}
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="month">Month/Year</option>
                      <option value="range">Date Range</option>
                    </select>
                  </div>
                  
                  {monthlyAllDateRangeMode === 'month' ? (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">Month:</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={monthlyAllMonth}
                          onChange={(e) => setMonthlyAllMonth(e.target.value)}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val && !isNaN(val)) {
                              const num = parseInt(val, 10);
                              if (num >= 1 && num <= 12) {
                                setMonthlyAllMonth(String(num).padStart(2, '0'));
                              }
                            }
                          }}
                          className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">Year:</label>
                        <input
                          type="number"
                          min="2000"
                          max="2100"
                          value={monthlyAllYear}
                          onChange={(e) => setMonthlyAllYear(e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">Start Date:</label>
                        <input
                          type="date"
                          value={monthlyAllStartDate}
                          onChange={(e) => setMonthlyAllStartDate(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">End Date:</label>
                        <input
                          type="date"
                          value={monthlyAllEndDate}
                          onChange={(e) => setMonthlyAllEndDate(e.target.value)}
                          min={monthlyAllStartDate}
                          className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Student:</label>
                    <select
                      value={monthlyAllStudentId}
                      onChange={(e) => {
                        setMonthlyAllStudentId(e.target.value)
                        if (e.target.value) {
                          setMonthlyAllFamilyId('') // Clear family when student is selected
                        }
                      }}
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm min-w-[150px]"
                    >
                      <option value="">All Students</option>
                      {students.filter(s => !s.archived).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Family:</label>
                    <select
                      value={monthlyAllFamilyId}
                      onChange={(e) => {
                        setMonthlyAllFamilyId(e.target.value)
                        if (e.target.value) {
                          setMonthlyAllStudentId('') // Clear student when family is selected
                        }
                      }}
                      className="px-2 py-1 border border-gray-300 rounded-md text-sm min-w-[150px]"
                    >
                      <option value="">All Families</option>
                      {families.map(family => (
                        <option key={family.familyId} value={family.familyId}>
                          {family.members.map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={loadMonthlyAll}
                    disabled={loadingMonthlyAll}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {loadingMonthlyAll ? 'Loading...' : 'Load Report'}
                  </button>
                </div>
              </div>

              {loadingMonthlyAll ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading report...</p>
                </div>
              ) : monthlyAllReport ? (
                <div className="p-4 space-y-6">
                  {/* Summary Totals */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-gray-900 mb-3">Summary Totals</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Previous Balance</p>
                        <p className="text-lg font-semibold">{formatCurrency(monthlyAllReport.totals.previousBalance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Billed {monthlyAllDateRangeMode === 'month' ? 'This Month' : 'This Period'}</p>
                        <p className="text-lg font-semibold">{formatCurrency(monthlyAllReport.totals.billedThisMonth)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Paid {monthlyAllDateRangeMode === 'month' ? 'This Month' : 'This Period'}</p>
                        <p className="text-lg font-semibold">{formatCurrency(monthlyAllReport.totals.paidThisMonth)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Ending Balance</p>
                        <p className={`text-lg font-semibold ${
                          monthlyAllReport.totals.endingBalance > 0 ? 'text-blue-600' : 
                          monthlyAllReport.totals.endingBalance < 0 ? 'text-red-600' : 
                          'text-gray-900'
                        }`}>
                          {formatCurrency(monthlyAllReport.totals.endingBalance)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Total Lessons:</p>
                        <p className="font-semibold">{monthlyAllReport.totals.totalLessons}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Billed Lessons:</p>
                        <p className="font-semibold">{monthlyAllReport.totals.totalBilledLessons}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Payments:</p>
                        <p className="font-semibold">{monthlyAllReport.totals.totalPayments}</p>
                      </div>
                    </div>
                  </div>

                  {/* Students/Families Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {monthlyAllFamilyId ? 'Family' : 'Student'}
                          </th>
                          {monthlyAllFamilyId && (
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                          )}
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Balance</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Billed {monthlyAllDateRangeMode === 'month' ? 'This Month' : 'This Period'}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid {monthlyAllDateRangeMode === 'month' ? 'This Month' : 'This Period'}</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ending Balance</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Lessons</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Payments</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {monthlyAllReport.students.length === 0 ? (
                          <tr>
                            <td colSpan={monthlyAllFamilyId ? 8 : 7} className="px-4 py-6 text-center text-sm text-gray-500">No {monthlyAllFamilyId ? 'families' : 'students'} found</td>
                          </tr>
                        ) : (
                          monthlyAllReport.students.map((row) => (
                            <tr key={row.familyId || row.studentId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {row.familyName || row.studentName}
                              </td>
                              {monthlyAllFamilyId && (
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                  {row.studentCount || 1}
                                </td>
                              )}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                {formatCurrency(row.previousBalance)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                {formatCurrency(row.billedThisMonth)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                {formatCurrency(row.paidThisMonth)}
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                row.endingBalance > 0 ? 'text-blue-600' : 
                                row.endingBalance < 0 ? 'text-red-600' : 
                                'text-gray-900'
                              }`}>
                                {formatCurrency(row.endingBalance)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                {row.lessonsCount} ({row.billedLessonsCount} billed)
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                {row.paymentsCount}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Detailed Student/Family Breakdown */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-900">{monthlyAllFamilyId ? 'Family Details' : 'Student Details'}</h3>
                    {monthlyAllReport.students.map((row) => (
                      <div key={row.familyId || row.studentId} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-900">{row.familyName || row.studentName}</h4>
                          {row.studentCount && row.studentCount > 1 && (
                            <p className="text-xs text-gray-600 mt-1">{row.studentCount} students in family</p>
                          )}
                          <div className="flex gap-4 mt-1 text-xs text-gray-600">
                            <span>Previous Balance: {formatCurrency(row.previousBalance)}</span>
                            <span>Billed: {formatCurrency(row.billedThisMonth)}</span>
                            <span>Paid: {formatCurrency(row.paidThisMonth)}</span>
                            <span className={`font-semibold ${
                              row.endingBalance > 0 ? 'text-blue-600' : 
                              row.endingBalance < 0 ? 'text-red-600' : 
                              'text-gray-900'
                            }`}>
                              Ending Balance: {formatCurrency(row.endingBalance)}
                            </span>
                          </div>
                        </div>

                        {/* Lessons */}
                        {row.lessons && row.lessons.length > 0 && (
                          <div className="p-4">
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">
                              Lessons ({row.lessons.length} total for {monthlyAllFamilyId ? 'all family members' : 'student'})
                            </h5>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Date</th>
                                    {monthlyAllFamilyId && (
                                      <th className="px-2 py-1 text-left">Student</th>
                                    )}
                                    <th className="px-2 py-1 text-left">Subject</th>
                                    <th className="px-2 py-1 text-right">Duration</th>
                                    <th className="px-2 py-1 text-right">Price</th>
                                    <th className="px-2 py-1 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {row.lessons.map((lesson) => (
                                    <tr key={lesson.id}>
                                      <td className="px-2 py-1">
                                        {new Date(lesson.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                      </td>
                                      {monthlyAllFamilyId && (
                                        <td className="px-2 py-1 text-gray-600">
                                          {lesson.student ? `${lesson.student.firstName} ${lesson.student.lastName}` : '-'}
                                        </td>
                                      )}
                                      <td className="px-2 py-1">{lesson.subject || '-'}</td>
                                      <td className="px-2 py-1 text-right">{lesson.duration || '-'}</td>
                                      <td className="px-2 py-1 text-right">{formatCurrency(lesson.price ?? 0)}</td>
                                      <td className="px-2 py-1 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                          new Date(lesson.dateTime) < new Date() ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                          {new Date(lesson.dateTime) < new Date() ? 'Billed' : 'Future'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Payments */}
                        {row.payments && row.payments.length > 0 && (
                          <div className="p-4 border-t border-gray-200">
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">
                              Payments ({row.payments.length} {monthlyAllFamilyId ? 'for family' : 'for student'})
                            </h5>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Date</th>
                                    <th className="px-2 py-1 text-right">Amount</th>
                                    <th className="px-2 py-1 text-left">Method</th>
                                    <th className="px-2 py-1 text-left">Notes</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {row.payments.map((payment) => (
                                    <tr key={payment.id}>
                                      <td className="px-2 py-1">
                                        {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </td>
                                      <td className="px-2 py-1 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                                      <td className="px-2 py-1">{payment.method || '-'}</td>
                                      <td className="px-2 py-1">{payment.notes || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>Select a month and year, then click "Load Report" to view the monthly report for all students.</p>
                </div>
              )}
            </>
          )}



          {activeReport === 'packages' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Package Tracking Report</h2>
                  <p className="text-sm text-gray-500">Track all packages, their utilization, and status.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Filter:</label>
                  <select
                    value={packagesFilter}
                    onChange={async (e) => {
                      const newFilter = e.target.value
                      setPackagesFilter(newFilter)
                      try {
                        const { data } = await api.get('/reports/packages', { params: { status: newFilter } })
                        console.log('Packages report data after filter change:', data)
                        if (data && data.packages) {
                          setPackagesReport(data)
                        } else {
                          console.error('Invalid packages report data structure:', data)
                          setPackagesReport({ packages: [], summary: {} })
                        }
                      } catch (error) {
                        console.error('Failed to load packages report:', error)
                        toast.error(error.response?.data?.message || 'Failed to load packages report')
                      }
                    }}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-0"
                  >
                    <option value="all">All Packages</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                  {packagesReport.packages && packagesReport.packages.length > 0 && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Are you sure you want to delete all ${packagesReport.packages.length} packages? This will also unlink any lessons from packages. This action cannot be undone.`)) {
                          return
                        }
                        try {
                          const { data } = await api.delete('/packages/all')
                          toast.success(data.message || `Deleted ${data.deletedCount || 0} packages`)
                          // Reload the packages report
                          const { data: reportData } = await api.get('/reports/packages', { params: { status: packagesFilter } })
                          if (reportData && reportData.packages) {
                            setPackagesReport(reportData)
                          } else {
                            setPackagesReport({ packages: [], summary: {} })
                          }
                        } catch (error) {
                          console.error('Failed to delete all packages:', error)
                          toast.error(error.response?.data?.message || 'Failed to delete all packages')
                        }
                      }}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Delete All Packages
                    </button>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              {packagesReport.summary && Object.keys(packagesReport.summary).length > 0 && (
                <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Total Packages</p>
                      <p className="text-lg font-semibold text-gray-900">{packagesReport.summary.totalPackages || 0}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Active Packages</p>
                      <p className="text-lg font-semibold text-green-700">{packagesReport.summary.activePackages || 0}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Total Revenue</p>
                      <p className="text-lg font-semibold text-gray-900">${(packagesReport.summary.totalPackageRevenue || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Avg Utilization</p>
                      <p className="text-lg font-semibold text-gray-900">{(packagesReport.summary.averageUtilization || 0).toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Hours Purchased</p>
                      <p className="text-lg font-semibold text-gray-900">{(packagesReport.summary.totalHoursPurchased || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Hours Used</p>
                      <p className="text-lg font-semibold text-indigo-700">{(packagesReport.summary.totalHoursUsed || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Hours Remaining</p>
                      <p className="text-lg font-semibold text-green-700">{(packagesReport.summary.totalHoursRemaining || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Packages Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price / Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchased</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lessons</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {packagesReport.packages.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">No packages found</td>
                      </tr>
                    ) : (
                      packagesReport.packages.map((pkg) => {
                        const statusColors = {
                          'Active': 'bg-green-100 text-green-800',
                          'Used Up': 'bg-yellow-100 text-yellow-800',
                          'Expired': 'bg-red-100 text-red-800',
                          'Inactive': 'bg-gray-100 text-gray-800'
                        }
                        return (
                          <>
                            <tr key={pkg.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{pkg.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {pkg.student.firstName} {pkg.student.lastName}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[pkg.status] || 'bg-gray-100 text-gray-800'}`}>
                                  {pkg.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  <span className="font-medium">{pkg.hoursRemaining.toFixed(2)}</span>
                                  <span className="text-gray-500"> / {pkg.totalHours.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-gray-500">Used: {pkg.hoursUsed.toFixed(2)}h</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2" style={{ minWidth: '60px' }}>
                                    <div 
                                      className={`h-2 rounded-full ${
                                        pkg.utilizationPercent >= 100 ? 'bg-yellow-600' :
                                        pkg.utilizationPercent >= 75 ? 'bg-orange-500' :
                                        'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(pkg.utilizationPercent, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-900">{pkg.utilizationPercent.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">${pkg.price.toFixed(2)}</div>
                                <div className="text-xs text-gray-500">${pkg.packageHourlyRate.toFixed(2)}/hr</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(pkg.purchasedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {pkg.expiresAt 
                                  ? new Date(pkg.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                  : 'No expiry'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={async () => {
                                    if (selectedPackageId === pkg.id) {
                                      setSelectedPackageId(null)
                                      setPackageLessons([])
                                    } else {
                                      setSelectedPackageId(pkg.id)
                                      try {
                                        const { data } = await api.get(`/packages/${pkg.id}/usage`)
                                        setPackageLessons(data.usage || [])
                                      } catch (error) {
                                        console.error('Failed to load package lessons:', error)
                                        toast.error('Failed to load package lessons')
                                      }
                                    }
                                  }}
                                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  {selectedPackageId === pkg.id ? 'Hide' : 'View'} Lessons
                                </button>
                              </td>
                            </tr>
                            {selectedPackageId === pkg.id && (
                              <tr>
                                <td colSpan="9" className="px-6 py-4 bg-gray-50">
                                  <div className="mt-2">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Lessons Covered by This Package</h4>
                                    {packageLessons.length === 0 ? (
                                      <p className="text-sm text-gray-500">No lessons have been covered by this package yet.</p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                          <thead className="bg-white">
                                            <tr>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-gray-200">
                                            {packageLessons.map((lesson) => (
                                              <tr key={lesson.lessonId}>
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  {new Date(lesson.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900">{lesson.subject}</td>
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  {lesson.hours.toFixed(2)}h ({lesson.duration} min)
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  ${lesson.price.toFixed(2)}
                                                  <span className="text-xs text-gray-500 ml-1">
                                                    (${lesson.pricePerHour.toFixed(2)}/hr)
                                                  </span>
                                                </td>
                                                <td className="px-4 py-2 text-sm">
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  {(() => {
                                                    const isFullyPaid = lesson.isPaid;
                                                    const paidAmount = lesson.paidAmount || 0;
                                                    const price = lesson.price || 0;
                                                    const isPartiallyPaid = !isFullyPaid && paidAmount > 0 && paidAmount < price;
                                                    
                                                    if (isFullyPaid) {
                                                      return <span className="text-green-600 font-medium">${paidAmount.toFixed(2)} Paid</span>;
                                                    } else if (isPartiallyPaid) {
                                                      return <span className="text-yellow-600 font-medium">${paidAmount.toFixed(2)} Partially Paid</span>;
                                                    } else {
                                                      return <span className="text-gray-500">Unpaid</span>;
                                                    }
                                                  })()}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}


          {activeReport === 'lessonsPayments' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Lessons & Payments Report</h2>
                  <p className="text-sm text-gray-500">List of lessons with payment information by month.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-sm text-gray-600">Student:</label>
                  <select
                    value={lessonsPaymentsStudent}
                    onChange={(e) => setLessonsPaymentsStudent(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm min-w-[150px]"
                  >
                    <option value="">All Students</option>
                    {students
                      .filter(s => !s.isDeleted)
                      .sort((a, b) => {
                        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
                        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
                        return nameA.localeCompare(nameB)
                      })
                      .map(student => (
                        <option key={student.id} value={student.id}>
                          {student.firstName} {student.lastName}
                        </option>
                      ))}
                  </select>
                  <label className="flex items-center gap-1 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={lessonsPaymentsShowAllTime}
                      onChange={(e) => setLessonsPaymentsShowAllTime(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    All Time
                  </label>
                  {!lessonsPaymentsShowAllTime && (
                    <>
                  <label className="text-sm text-gray-600">Month:</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={lessonsPaymentsMonth}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= 12)) {
                        setLessonsPaymentsMonth(val.padStart(2, '0'))
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value
                      const currentDate = new Date()
                      if (val === '' || parseInt(val) < 1 || parseInt(val) > 12) {
                        setLessonsPaymentsMonth(String(currentDate.getMonth() + 1).padStart(2, '0'))
                      } else {
                        setLessonsPaymentsMonth(String(parseInt(val)).padStart(2, '0'))
                      }
                    }}
                    className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                  <label className="text-sm text-gray-600">Year:</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={lessonsPaymentsYear}
                    onChange={(e) => setLessonsPaymentsYear(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                    </>
                  )}
                  <button
                    onClick={loadLessonsPaymentsReport}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                  >
                    Load Report
                  </button>
                </div>
              </div>

                {lessonsPaymentsReport ? (
                <div>
                  {/* Statistics Summary */}
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Lessons</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {lessonsPaymentsReport.lessons.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Charged</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(
                            lessonsPaymentsReport.lessons.reduce((sum, lesson) => sum + (lesson.price || 0), 0)
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                        <p className="text-lg font-semibold text-green-700">
                          {formatCurrency(
                            lessonsPaymentsReport.lessons.reduce((sum, lesson) => {
                              const lessonPaid = lesson.payments.reduce((pSum, payment) => pSum + (payment.amount || 0), 0)
                              return sum + lessonPaid
                            }, 0)
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Outstanding Balance</p>
                        <p className={`text-lg font-semibold ${
                          (() => {
                            const totalCharged = lessonsPaymentsReport.lessons.reduce((sum, lesson) => sum + (lesson.price || 0), 0)
                            const totalPaid = lessonsPaymentsReport.lessons.reduce((sum, lesson) => {
                              const lessonPaid = lesson.payments.reduce((pSum, payment) => pSum + (payment.amount || 0), 0)
                              return sum + lessonPaid
                            }, 0)
                            const balance = totalCharged - totalPaid
                            return balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-600' : 'text-gray-900'
                          })()
                        }`}>
                          {formatCurrency(
                            (() => {
                              const totalCharged = lessonsPaymentsReport.lessons.reduce((sum, lesson) => sum + (lesson.price || 0), 0)
                              const totalPaid = lessonsPaymentsReport.lessons.reduce((sum, lesson) => {
                                const lessonPaid = lesson.payments.reduce((pSum, payment) => pSum + (payment.amount || 0), 0)
                                return sum + lessonPaid
                              }, 0)
                              return totalCharged - totalPaid
                            })()
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => {
                            if (sortColumn === 'name') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                            } else {
                              setSortColumn('name')
                              setSortDirection('asc')
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Name
                            {sortColumn === 'name' && (
                              <span className="text-gray-700">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => {
                            if (sortColumn === 'date') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
                            } else {
                              setSortColumn('date')
                              setSortDirection('asc')
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Date
                            {sortColumn === 'date' && (
                              <span className="text-gray-700">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">How much is paid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date of payment</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment method</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lessonsPaymentsReport.lessons.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                            No lessons found
                            {lessonsPaymentsStudent ? ` for ${students.find(s => s.id === lessonsPaymentsStudent) ? `${students.find(s => s.id === lessonsPaymentsStudent).firstName} ${students.find(s => s.id === lessonsPaymentsStudent).lastName}` : 'selected student'}` : ''}
                            {lessonsPaymentsReport.month && lessonsPaymentsReport.year ? ` for ${new Date(parseInt(lessonsPaymentsReport.year), parseInt(lessonsPaymentsReport.month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ' for all time'}
                          </td>
                        </tr>
                      ) : (
                        // Sort lessons based on selected column
                        (() => {
                          const sortedLessons = [...lessonsPaymentsReport.lessons].sort((a, b) => {
                            let comparison = 0
                            
                            if (sortColumn === 'date') {
                              // Parse date string (format: MM/DD/YYYY)
                              const parseDate = (dateStr) => {
                                const [month, day, year] = dateStr.split('/').map(Number)
                                return new Date(year, month - 1, day)
                              }
                              const dateA = parseDate(a.date)
                              const dateB = parseDate(b.date)
                              comparison = dateA - dateB
                            } else if (sortColumn === 'name') {
                              comparison = a.name.localeCompare(b.name)
                            }
                            
                            return sortDirection === 'asc' ? comparison : -comparison
                          })
                          
                          // Debug: Check for duplicate lesson IDs in the sorted array
                          const seenIds = new Set()
                          const duplicateIds = []
                          sortedLessons.forEach(lesson => {
                            if (seenIds.has(lesson.id)) {
                              duplicateIds.push(lesson.id)
                            }
                            seenIds.add(lesson.id)
                          })
                          if (duplicateIds.length > 0) {
                            console.warn(`[Frontend Rendering] Found ${duplicateIds.length} duplicate lesson ID(s) in sorted array:`, duplicateIds)
                            console.log(`[Frontend Rendering] All lesson IDs in array:`, sortedLessons.map(l => ({ id: l.id, name: l.name, date: l.date, payments: l.payments.length })))
                          }
                          
                          // Deduplicate by ID just before rendering (safety check)
                          const renderLessons = []
                          const renderIdsSeen = new Set()
                          sortedLessons.forEach(lesson => {
                            if (!renderIdsSeen.has(lesson.id)) {
                              renderIdsSeen.add(lesson.id)
                              renderLessons.push(lesson)
                            } else {
                              console.warn(`[Frontend Rendering] Skipping duplicate lesson ID ${lesson.id} during render`)
                            }
                          })
                          
                          return renderLessons
                        })()
                          .flatMap((lesson, index) => {
                          const isLinking = linkingLessonId === lesson.id
                          const needsMorePayment = (lesson.paidAmount || 0) < (lesson.price || 0)
                          
                          // If no payments, show one row with empty payment info
                          if (lesson.payments.length === 0) {
                            // Check if this is a complimentary lesson (price = 0, marked as paid)
                            const isComplimentary = lesson.price === 0 && (lesson.paidAmount || 0) >= (lesson.price || 0)
                            
                            return (
                              <tr key={`lesson-${lesson.id}-no-payment`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${lesson.price.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{isComplimentary ? '$0.00' : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{isComplimentary ? lesson.date : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{isComplimentary ? 'Complimentary' : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  {isLinking ? (
                                    <div className="relative">
                                      {loadingPayments ? (
                                        <span className="text-xs text-gray-500">Loading...</span>
                                      ) : (
                                        <div className="flex flex-col gap-1">
                                          <select
                                            onChange={async (e) => {
                                              if (e.target.value) {
                                                await handleLinkPayment(lesson.id, e.target.value, true)
                                                // Reset select value to allow selecting again
                                                e.target.value = ''
                                              }
                                            }}
                                            className="text-xs border border-gray-300 rounded px-2 py-1"
                                            autoFocus
                                          >
                                            <option value="">Select payment to link...</option>
                                            {availablePayments.length === 0 ? (
                                              <option value="" disabled>No available payments</option>
                                            ) : (
                                              availablePayments.map(payment => (
                                                <option key={payment.id} value={payment.id}>
                                                  ${payment.amount.toFixed(2)} - {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({payment.method || 'No method'}){payment.familyId ? ' [Family]' : ''}
                                                </option>
                                              ))
                                            )}
                                          </select>
                                          <button
                                            onClick={() => {
                                              setLinkingLessonId(null)
                                              setAvailablePayments([])
                                            }}
                                            className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 border border-gray-300 rounded"
                                          >
                                            Done
                                          </button>
                                    </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="relative">
                                      <button
                                        onClick={() => setOpenDropdown(openDropdown === lesson.id ? null : lesson.id)}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 border border-gray-300 rounded"
                                      >
                                        Actions ▼
                                      </button>
                                      {openDropdown === lesson.id && (
                                        <div className="absolute right-0 bottom-full mb-1 w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 max-h-64 overflow-y-auto">
                                          <div className="py-1">
                                            <button
                                              onClick={() => {
                                                fetchAvailablePayments(lesson.studentId, lesson.id, false)
                                                setOpenDropdown(null)
                                              }}
                                              className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                            >
                                              Link Existing Payment
                                            </button>
                                            <button
                                              onClick={() => {
                                                // Extract date from lesson date string (format: MM/DD/YYYY)
                                                let lessonDate = new Date().toISOString().split('T')[0]
                                                if (lesson.date) {
                                                  // Parse date string like "09/12/2025" to YYYY-MM-DD
                                                  const dateParts = lesson.date.split('/')
                                                  if (dateParts.length === 3) {
                                                    const month = dateParts[0].padStart(2, '0')
                                                    const day = dateParts[1].padStart(2, '0')
                                                    const year = dateParts[2]
                                                    lessonDate = `${year}-${month}-${day}`
                                                  }
                                                }
                                                setCreatingPaymentForLesson(lesson)
                                                setNewPaymentForm({
                                                  amount: (lesson.price - (lesson.paidAmount || 0)).toFixed(2),
                                                  date: lessonDate,
                                                  method: 'venmo',
                                                  notes: ''
                                                })
                                                setShowCreatePaymentModal(true)
                                                setOpenDropdown(null)
                                              }}
                                              className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                            >
                                              Add New Payment
                                            </button>
                                            <button
                                              onClick={() => {
                                                handleMarkAsComplimentary(lesson)
                                                setOpenDropdown(null)
                                              }}
                                              className="block w-full text-left px-4 py-2 text-xs text-blue-600 hover:bg-gray-100"
                                            >
                                              Mark as Complimentary
                                            </button>
                                            {(lesson.paidAmount || 0) >= (lesson.price || 0) && lesson.payments.length === 0 && (
                                              <button
                                                onClick={() => {
                                                  handleMarkPaidStatus(lesson.id, false)
                                                  setOpenDropdown(null)
                                                }}
                                                className="block w-full text-left px-4 py-2 text-xs text-orange-600 hover:bg-gray-100"
                                              >
                                                Mark as Unpaid
                                              </button>
                                            )}
                                          </div>
                  </div>
                )}
              </div>
                              )}
                            </td>
                          </tr>
                            )
                          }
                          // If there are payments, show ONE row per lesson (aggregate all payments)
                          const totalPaid = lesson.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
                          const earliestPaymentDate = lesson.payments.length > 0 
                            ? lesson.payments.reduce((earliest, p) => {
                                const pDate = new Date(p.date)
                                return !earliest || pDate < earliest ? pDate : earliest
                              }, null)
                            : null
                          const paymentMethods = [...new Set(lesson.payments.map(p => p.method || 'Unknown').filter(m => m))].join(', ')
                          const isFirstPaymentRow = true // Only one row now, so always first
                          
                          return (
                            <tr key={`lesson-${lesson.id}`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lesson.date}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${lesson.price.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${totalPaid.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {earliestPaymentDate ? new Date(earliestPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {lesson.payments.length > 1 ? `Multiple (${paymentMethods})` : (paymentMethods || '-')}
                              </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <div className="relative">
                                    {isLinking && isFirstPaymentRow ? (
                                      <div className="relative">
                                        {loadingPayments ? (
                                          <span className="text-xs text-gray-500">Loading...</span>
                                        ) : (
                                          <div className="flex flex-col gap-1">
                  <select
                                              onChange={async (e) => {
                                                if (e.target.value) {
                                                  await handleLinkPayment(lesson.id, e.target.value, true)
                                                  // Reset select value to allow selecting again
                                                  e.target.value = ''
                                                }
                                              }}
                                              className="text-xs border border-gray-300 rounded px-2 py-1"
                                              autoFocus
                                            >
                                              <option value="">Select payment to link...</option>
                                              {availablePayments.length === 0 ? (
                                                <option value="" disabled>No available payments</option>
                                              ) : (
                                                availablePayments.map(p => (
                                                  <option key={p.id} value={p.id}>
                                                    ${p.amount.toFixed(2)} - {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({p.method || 'No method'})
                                                  </option>
                                                ))
                                              )}
                  </select>
                                            <button
                                              onClick={() => {
                                                setLinkingLessonId(null)
                                                setAvailablePayments([])
                                              }}
                                              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 border border-gray-300 rounded"
                                            >
                                              Done
                                            </button>
                </div>
                                        )}
              </div>
                                    ) : (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setOpenDropdown(openDropdown === lesson.id ? null : lesson.id)
                                          }}
                                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 border border-gray-300 rounded"
                                        >
                                          Actions ▼
                                        </button>
                                        {openDropdown === lesson.id && (
                                          <div className="absolute right-0 bottom-full mb-1 w-64 bg-white rounded-md shadow-lg z-20 border border-gray-200 max-h-64 overflow-y-auto">
                                            <div className="py-1">
                                              {isFirstPaymentRow && (
                                                <>
                                                  <button
                                                    onClick={() => {
                                                      fetchAvailablePayments(lesson.studentId, lesson.id, false)
                                                      setOpenDropdown(null)
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                                  >
                                                    {lesson.payments.length > 0 ? 'Link Additional Payment' : 'Link Existing Payment'}
                                                  </button>
                                                  {lesson.payments.length > 0 && (
                                                    <button
                                                      onClick={() => {
                                                        // Change Payment: unlink all existing, then link new one
                                                        fetchAvailablePayments(lesson.studentId, lesson.id, true)
                                                        setOpenDropdown(null)
                                                      }}
                                                      className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                                    >
                                                      Change All Payments
                                                    </button>
                                                  )}
                                                  <button
                                                    onClick={() => {
                                                      // Extract date from lesson date string (format: MM/DD/YYYY)
                                                      let lessonDate = new Date().toISOString().split('T')[0]
                                                      if (lesson.date) {
                                                        // Parse date string like "09/12/2025" to YYYY-MM-DD
                                                        const dateParts = lesson.date.split('/')
                                                        if (dateParts.length === 3) {
                                                          const month = dateParts[0].padStart(2, '0')
                                                          const day = dateParts[1].padStart(2, '0')
                                                          const year = dateParts[2]
                                                          lessonDate = `${year}-${month}-${day}`
                                                        }
                                                      }
                                                      setCreatingPaymentForLesson(lesson)
                                                      setNewPaymentForm({
                                                        amount: (lesson.price - (lesson.paidAmount || 0)).toFixed(2),
                                                        date: lessonDate,
                                                        method: 'venmo',
                                                        notes: ''
                                                      })
                                                      setShowCreatePaymentModal(true)
                                                      setOpenDropdown(null)
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                                                  >
                                                    Add New Payment
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      handleMarkAsComplimentary(lesson)
                                                      setOpenDropdown(null)
                                                    }}
                                                    className="block w-full text-left px-4 py-2 text-xs text-blue-600 hover:bg-gray-100"
                                                  >
                                                    Mark as Complimentary
                                                  </button>
                                                </>
                                              )}
                                              {lesson.payments.length > 0 && (
                                                <>
                                                  {lesson.payments.map((payment) => (
                                                    <div key={payment.id} className="border-t border-gray-200 pt-1 mt-1">
                                                      <div className="px-4 py-1 text-xs text-gray-500">
                                                        ${payment.amount.toFixed(2)} - {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <button
                                                        onClick={() => {
                                                          handleUnlinkPayment(lesson.id, payment.id)
                                                          setOpenDropdown(null)
                                                        }}
                                                        className="block w-full text-left px-4 py-2 text-xs text-orange-600 hover:bg-gray-100"
                                                      >
                                                        Unlink This Payment
                                                      </button>
                                                      <button
                                                        onClick={() => {
                                                          handleDeletePayment(payment.id)
                                                          setOpenDropdown(null)
                                                        }}
                                                        className="block w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-gray-100"
                                                      >
                                                        Delete This Payment
                    </button>
                  </div>
                                                  ))}
                                                </>
                                              )}
                      </div>
                      </div>
                                        )}
                                      </>
                                    )}
                      </div>
                            </td>
                                      </tr>
                                    )
                                  })
                              )}
                            </tbody>
                          </table>
                        </div>
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Select a month and year, then click "Load Report"
                      </div>
                )}
            </>
          )}

        </div>
      </div>

      {/* Close dropdowns when clicking outside */}
      {openDropdown && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setOpenDropdown(null)}
        />
      )}

      {/* Create Payment Modal */}
      {showCreatePaymentModal && creatingPaymentForLesson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Create New Payment for {creatingPaymentForLesson.name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newPaymentForm.amount}
                  onChange={(e) => setNewPaymentForm({ ...newPaymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="0.00"
                />
                        </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newPaymentForm.date}
                  onChange={(e) => setNewPaymentForm({ ...newPaymentForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                      </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={newPaymentForm.method}
                  onChange={(e) => setNewPaymentForm({ ...newPaymentForm, method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="venmo">Venmo</option>
                  <option value="zelle">Zelle</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
                    </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={newPaymentForm.notes}
                  onChange={(e) => setNewPaymentForm({ ...newPaymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows="2"
                  placeholder="Additional notes..."
                />
                  </div>
              </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  if (isCreatingPayment) return // Prevent cancel during save
                  setShowCreatePaymentModal(false)
                  setCreatingPaymentForLesson(null)
                  setNewPaymentForm({
                    amount: '',
                    date: new Date().toISOString().split('T')[0],
                    method: 'venmo',
                    notes: ''
                  })
                }}
                disabled={isCreatingPayment}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreatePayment(creatingPaymentForLesson)}
                disabled={isCreatingPayment}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingPayment ? 'Creating...' : 'Create & Link Payment'}
              </button>
        </div>
      </div>
        </div>
      )}
      
    </div>
  )
}

