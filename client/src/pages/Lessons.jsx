import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Edit, Trash2, Clock, User, Calendar as CalendarIcon, MapPin, Video, DollarSign, FileText, ChevronUp, ChevronDown, X } from 'lucide-react'
import toast from 'react-hot-toast'

// Custom 24-hour time picker component
const TimePicker24 = ({ value, onChange, className = '' }) => {
  // Parse HH:mm format
  const [hours, minutes] = (value || '09:00').split(':').map(v => parseInt(v, 10))
  
  const handleHourChange = (e) => {
    const newHour = parseInt(e.target.value, 10)
    onChange(`${String(newHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
  }
  
  const handleMinuteChange = (e) => {
    const newMinute = parseInt(e.target.value, 10)
    onChange(`${String(hours).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`)
  }
  
  return (
    <div className={`flex gap-1 ${className}`}>
      <select
        value={hours}
        onChange={handleHourChange}
        className="flex-1 text-sm border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="self-center text-gray-500">:</span>
      <select
        value={minutes}
        onChange={handleMinuteChange}
        className="flex-1 text-sm border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1"
      >
        {Array.from({ length: 12 }, (_, i) => {
          const min = i * 5
          return <option key={min} value={min}>{String(min).padStart(2, '0')}</option>
        })}
      </select>
    </div>
  )
}

export function Lessons() {
  const [lessons, setLessons] = useState([])
  const [sortedLessons, setSortedLessons] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'dateTime', direction: 'asc' })
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudentFilter, setSelectedStudentFilter] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false)
  const [showPastOnly, setShowPastOnly] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showLinkPaymentModal, setShowLinkPaymentModal] = useState(false)
  const [availablePayments, setAvailablePayments] = useState([])
  const [selectedPaymentId, setSelectedPaymentId] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showRecurringOptions, setShowRecurringOptions] = useState(false)
  const [recurringAction, setRecurringAction] = useState(null)
  const [endRepeatType, setEndRepeatType] = useState('date') // 'date', 'count', or 'schoolYear'
  const [numberOfClasses, setNumberOfClasses] = useState(10)
  const [formData, setFormData] = useState(() => ({
    studentId: '',
    dateTime: '',
    endDateTime: '',
    subject: '',
    price: 0,
    notes: '',
    status: 'scheduled',
    locationType: 'in-person',
    link: '',
    isRecurring: false,
    recurringFrequency: 'weekly',
    recurringEndDate: '',
    allDay: false
  }))

  const getCurrentDateTime = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const getEndDateTime = (startDateTime) => {
    if (!startDateTime) return ''
    const start = new Date(startDateTime)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const year = end.getFullYear()
    const month = String(end.getMonth() + 1).padStart(2, '0')
    const day = String(end.getDate()).padStart(2, '0')
    const hours = String(end.getHours()).padStart(2, '0')
    const minutes = String(end.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const calculatePrice = (studentId, durationMinutes) => {
    if (!studentId || !durationMinutes) return 0
    const selectedStudent = students.find(s => s.id === studentId)
    if (!selectedStudent || !selectedStudent.pricePerLesson) return 0
    // pricePerLesson is now hourly rate, calculate: (hourlyRate * durationInMinutes) / 60
    return (selectedStudent.pricePerLesson * durationMinutes) / 60
  }

  const handleStudentChange = (studentId) => {
    const selectedStudent = students.find(s => s.id === studentId)
    if (selectedStudent) {
      const studentName = `${selectedStudent.firstName} ${selectedStudent.lastName}`
      const subjectText = selectedStudent.subject 
        ? `${studentName} - ${selectedStudent.subject}` 
        : studentName
      
      // Calculate price based on hourly rate and current duration
      const durationMinutes = formData.endDateTime && formData.dateTime
        ? Math.round((new Date(formData.endDateTime) - new Date(formData.dateTime)) / 60000)
        : 60 // Default 60 minutes
      const calculatedPrice = calculatePrice(studentId, durationMinutes)
      
      setFormData({
        ...formData,
        studentId,
        subject: subjectText,
        price: calculatedPrice
      })
    } else {
      setFormData({ ...formData, studentId, subject: '' })
    }
  }

  useEffect(() => {
    fetchLessons()
    fetchStudents()
  }, [])

  useEffect(() => {
    fetchLessons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, selectedStudentFilter])

  const fetchLessons = async () => {
    try {
      const params = {}
      if (selectedMonth && selectedYear) {
        params.month = selectedMonth
        params.year = selectedYear
      }
      if (selectedStudentFilter) {
        params.studentId = selectedStudentFilter
      }
      
      const { data } = await api.get('/lessons', { params })
      setLessons(data)
      applyFilterAndSort(data)
      // Update selected lesson if it exists (to reflect any changes)
      if (selectedLesson) {
        const updatedLesson = data.find(l => l.id === selectedLesson.id)
        if (updatedLesson) {
          setSelectedLesson(updatedLesson)
        }
      }
    } catch (error) {
      toast.error('Failed to load lessons')
    }
  }

  const applyFilterAndSort = (lessonsData) => {
    // Note: Student and month/year filtering is now done on the backend
    // Only apply client-side filters here (unpaid, past)
    let filteredLessons = lessonsData
    
    // Filter by unpaid only if enabled
    if (showUnpaidOnly) {
      filteredLessons = filteredLessons.filter(lesson => !lesson.isPaid)
    }
    
    // Filter by past lessons only if enabled
    if (showPastOnly) {
      const now = new Date()
      filteredLessons = filteredLessons.filter(lesson => {
        const lessonDate = new Date(lesson.dateTime)
        return lessonDate < now
      })
    }
    
    // Apply sorting
    setSortedLessons(sortLessonData(filteredLessons, sortConfig.key, sortConfig.direction))
  }

  useEffect(() => {
    applyFilterAndSort(lessons)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons, showUnpaidOnly, showPastOnly, sortConfig.key, sortConfig.direction])

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students')
      setStudents(data)
    } catch (error) {
      toast.error('Failed to load students')
    }
  }

  const fetchPaymentsForStudent = async (studentId) => {
    try {
      const { data } = await api.get('/payments', {
        params: { studentId }
      })
      setAvailablePayments(data || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast.error('Failed to load payments')
      setAvailablePayments([])
    }
  }

  const sortLessonData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      let aValue, bValue

      if (key === 'studentName') {
        aValue = `${a.student.firstName} ${a.student.lastName}`.toLowerCase()
        bValue = `${b.student.firstName} ${b.student.lastName}`.toLowerCase()
      } else if (key === 'isPaid') {
        // Sort boolean: true (paid) comes after false (unpaid) in ascending order
        if (direction === 'asc') {
          return a.isPaid === b.isPaid ? 0 : a.isPaid ? 1 : -1
        } else {
          return a.isPaid === b.isPaid ? 0 : a.isPaid ? -1 : 1
        }
      } else {
        aValue = a[key]
        bValue = b[key]
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = ''
      if (bValue === null || bValue === undefined) bValue = ''

      if (typeof aValue === 'string' && key !== 'dateTime') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) {
        return direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }

  const sortData = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
    // Filter and sort will be applied by useEffect
  }

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) {
      return <ChevronUp className="ml-1 h-4 w-4 text-gray-300" />
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="ml-1 h-4 w-4 text-indigo-600" /> 
      : <ChevronDown className="ml-1 h-4 w-4 text-indigo-600" />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Client-side validation
    if (!formData.dateTime || !formData.endDateTime) {
      toast.error('Please select start and end times')
      return
    }
    
    if (!formData.studentId) {
      toast.error('Please select a student')
      return
    }

    // Calculate duration in minutes
    const start = new Date(formData.dateTime)
    const end = new Date(formData.endDateTime)
    const duration = Math.round((end - start) / 60000) // Convert ms to minutes

    if (duration <= 0) {
      toast.error('End time must be after start time')
      return
    }

    const submitData = {
      studentId: formData.studentId,
      dateTime: new Date(formData.dateTime).toISOString(),
      duration,
      subject: formData.subject,
      price: parseFloat(formData.price),
      status: formData.status,
      locationType: formData.locationType,
      allDay: formData.allDay
    }

    // Only include optional fields if they have values
    if (formData.notes) submitData.notes = formData.notes
    if (formData.locationType === 'remote' && formData.link) submitData.link = formData.link
    if (formData.isRecurring) {
      submitData.isRecurring = true
      submitData.recurringFrequency = formData.recurringFrequency
      submitData.recurringEndDate = new Date(formData.recurringEndDate).toISOString()
    }

    try {
      if (isEditing && selectedLesson) {
        // Check if lesson is recurring
        if (selectedLesson.isRecurring && formData.isRecurring) {
          // Editing a recurring lesson - show options
          setRecurringAction('save')
          setShowRecurringOptions(true)
        } else if (selectedLesson.isRecurring && !formData.isRecurring) {
          // Converting recurring to single
          const { data: updatedLesson } = await api.put(`/lessons/${selectedLesson.id}`, submitData)
          toast.success('Lesson updated to single event')
          await fetchLessons()
          // Update selected lesson with the fresh data
          if (updatedLesson) {
            setSelectedLesson(updatedLesson)
          }
          setShowModal(false)
          setIsEditing(false)
          resetForm()
        } else if (!selectedLesson.isRecurring && formData.isRecurring) {
          // Converting single to recurring
          const { data: updatedLesson } = await api.put(`/lessons/${selectedLesson.id}`, submitData)
          toast.success('Lesson converted to recurring series')
          await fetchLessons()
          // Update selected lesson with the fresh data
          if (updatedLesson) {
            setSelectedLesson(updatedLesson)
          }
          setShowModal(false)
          setIsEditing(false)
          resetForm()
        } else {
          // Single lesson update
          const { data: updatedLesson } = await api.put(`/lessons/${selectedLesson.id}`, submitData)
          toast.success('Lesson updated successfully')
          await fetchLessons()
          // Update selected lesson with the fresh data
          if (updatedLesson) {
            setSelectedLesson(updatedLesson)
          }
          setShowModal(false)
          setIsEditing(false)
          resetForm()
        }
      } else {
        // Creating new lesson
        await api.post('/lessons', submitData)
        toast.success(submitData.isRecurring ? 'Recurring lessons created successfully' : 'Lesson created successfully')
        fetchLessons()
        setShowModal(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error saving lesson:', error)
      toast.error('Failed to save lesson')
    }
  }

  const executeSave = async (updateAll = false) => {
    const start = new Date(formData.dateTime)
    const end = new Date(formData.endDateTime)
    const duration = Math.round((end - start) / 60000)

    const submitData = {
      studentId: formData.studentId,
      dateTime: new Date(formData.dateTime).toISOString(),
      duration,
      subject: formData.subject,
      price: parseFloat(formData.price),
      status: formData.status,
      locationType: formData.locationType,
      allDay: formData.allDay
    }

    if (formData.notes) submitData.notes = formData.notes
    if (formData.locationType === 'remote' && formData.link) submitData.link = formData.link
    // Always send isRecurring so backend knows when to convert recurring to non-recurring
    submitData.isRecurring = formData.isRecurring || false
    if (formData.isRecurring) {
      submitData.recurringFrequency = formData.recurringFrequency
      if (formData.recurringEndDate) {
        // Set to end of day (23:59:59.999) to ensure inclusive end date
        const endDate = new Date(formData.recurringEndDate)
        endDate.setHours(23, 59, 59, 999)
        submitData.recurringEndDate = endDate.toISOString()
      } else if (endRepeatType === 'schoolYear') {
        // Calculate end of school year if not already set
        const now = new Date()
        let year = now.getFullYear()
        if (now.getMonth() > 5) year = year + 1
        const schoolYearEnd = new Date(year, 5, 30)
        submitData.recurringEndDate = schoolYearEnd.toISOString()
      } else if (endRepeatType === 'count' && formData.dateTime && formData.recurringFrequency) {
        // Calculate from number of classes - end date should be the date/time of the last lesson
        const startDate = new Date(formData.dateTime)
        const endDate = new Date(startDate)
        const frequency = formData.recurringFrequency
        // For N classes, we need (N-1) intervals after the first one
        const occurrences = numberOfClasses - 1
        switch (frequency) {
          case 'daily':
            endDate.setDate(endDate.getDate() + occurrences)
            break
          case 'weekly':
            endDate.setDate(endDate.getDate() + (occurrences * 7))
            break
          case 'monthly':
            endDate.setMonth(endDate.getMonth() + occurrences)
            break
          case 'yearly':
            endDate.setFullYear(endDate.getFullYear() + occurrences)
            break
        }
        // Set to end of day in local timezone to ensure inclusive end date
        endDate.setHours(23, 59, 59, 999)
        submitData.recurringEndDate = endDate.toISOString()
      }
    } else {
      // Explicitly set to null when not recurring
      submitData.recurringFrequency = null
      submitData.recurringEndDate = null
    }

    try {
      let updatedLesson;
      if (updateAll) {
        const { data } = await api.put(`/lessons/${selectedLesson.id}/recurring-future`, submitData)
        updatedLesson = data
        toast.success('Recurring lessons updated successfully')
      } else {
        const { data } = await api.put(`/lessons/${selectedLesson.id}`, submitData)
        updatedLesson = data
        toast.success('Lesson updated successfully')
      }
      await fetchLessons()
      // Update selected lesson with the fresh data
      if (updatedLesson) {
        setSelectedLesson(updatedLesson)
      }
      setShowModal(false)
      setIsEditing(false)
      setShowRecurringOptions(false)
      setRecurringAction(null)
      resetForm()
    } catch (error) {
      toast.error('Failed to update lesson')
    }
  }

  const handleAddLesson = () => {
    resetForm()
    setIsEditing(false)
    setSelectedLesson(null)
    setFormData(prev => ({
      ...prev,
      dateTime: getCurrentDateTime(),
      endDateTime: getEndDateTime(getCurrentDateTime())
    }))
    setShowModal(true)
  }

  const handleEditLesson = () => {
    if (!selectedLesson) return

    const lessonDate = new Date(selectedLesson.dateTime)
    const endDate = new Date(lessonDate.getTime() + selectedLesson.duration * 60000)

    const formatDateTime = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    setFormData({
      studentId: selectedLesson.studentId,
      dateTime: formatDateTime(lessonDate),
      endDateTime: formatDateTime(endDate),
      subject: selectedLesson.subject,
      price: selectedLesson.price,
      notes: selectedLesson.notes || '',
      status: selectedLesson.status,
      locationType: selectedLesson.locationType || 'in-person',
      link: selectedLesson.link || '',
      isRecurring: selectedLesson.isRecurring || false,
      recurringFrequency: selectedLesson.recurringFrequency || 'weekly',
      recurringEndDate: selectedLesson.recurringEndDate ? new Date(selectedLesson.recurringEndDate).toISOString().split('T')[0] : '',
      allDay: selectedLesson.allDay || false
    })
    setIsEditing(true)
    setShowModal(true)
  }

  const handleDeleteLesson = () => {
    if (!selectedLesson) return

    if (selectedLesson.isRecurring) {
      setRecurringAction('delete')
      setShowRecurringOptions(true)
    } else {
      if (window.confirm('Are you sure you want to delete this lesson?')) {
        executeDelete(false)
      }
    }
  }

  const executeDelete = async (deleteAll = false) => {
    try {
      if (deleteAll) {
        await api.delete(`/lessons/${selectedLesson.id}/recurring-future`)
        toast.success('Recurring lessons deleted successfully')
      } else {
        await api.delete(`/lessons/${selectedLesson.id}`)
        toast.success('Lesson deleted successfully')
      }
      fetchLessons()
      setSelectedLesson(null)
      setShowRecurringOptions(false)
      setRecurringAction(null)
    } catch (error) {
      toast.error('Failed to delete lesson')
    }
  }

  const resetForm = () => {
    setFormData({
      studentId: '',
      dateTime: '',
      endDateTime: '',
      subject: '',
      price: 0,
      notes: '',
      status: 'scheduled',
      locationType: 'in-person',
      link: '',
      isRecurring: false,
      recurringFrequency: 'weekly',
      recurringEndDate: '',
      allDay: false
    })
  }

  const formatTime = (dateTime, duration, allDay) => {
    if (allDay) return 'All Day'
    const start = new Date(dateTime)
    const end = new Date(start.getTime() + duration * 60000)
    return `${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }

  const formatDate = (dateTime) => {
    return new Date(dateTime).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lessons List - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Lessons</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {sortedLessons.length} {sortedLessons.length === 1 ? 'lesson' : 'lessons'}
                  {(selectedStudentFilter || selectedMonth || selectedYear) && ` (filtered)`}
                </p>
              </div>
              <button
                onClick={handleAddLesson}
                className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Schedule new lesson"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            {/* Filters */}
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Student Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Filter by student:</label>
                  <select
                    value={selectedStudentFilter}
                    onChange={(e) => setSelectedStudentFilter(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Students</option>
                    {students
                      .filter(s => !s.archived)
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
                </div>

                {/* Month/Year Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Filter by month:</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Months</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthNum = i + 1
                      const date = new Date(2000, i, 1)
                      return (
                        <option key={monthNum} value={String(monthNum).padStart(2, '0')}>
                          {date.toLocaleDateString('en-US', { month: 'long' })}
                        </option>
                      )
                    })}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Years</option>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - 5 + i
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
              {/* Quick Filters */}
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600 whitespace-nowrap">Quick filters:</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showUnpaidOnly}
                      onChange={(e) => setShowUnpaidOnly(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">Unpaid only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPastOnly}
                      onChange={(e) => setShowPastOnly(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">Past lessons only</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sortable Column Headers */}
          {lessons.length > 0 && (
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div 
                className="col-span-3 flex items-center cursor-pointer hover:text-gray-700"
                onClick={() => sortData('studentName')}
              >
                Name
                <SortIcon column="studentName" />
              </div>
              <div 
                className="col-span-2 flex items-center cursor-pointer hover:text-gray-700"
                onClick={() => sortData('dateTime')}
              >
                Date
                <SortIcon column="dateTime" />
              </div>
              <div 
                className="col-span-2 flex items-center cursor-pointer hover:text-gray-700"
                onClick={() => sortData('dateTime')}
              >
                Time
                <SortIcon column="dateTime" />
              </div>
              <div 
                className="col-span-3 flex items-center cursor-pointer hover:text-gray-700"
                onClick={() => sortData('subject')}
              >
                Subject
                <SortIcon column="subject" />
              </div>
              <div 
                className="col-span-2 flex items-center cursor-pointer hover:text-gray-700"
                onClick={() => sortData('isPaid')}
              >
                Paid
                <SortIcon column="isPaid" />
              </div>
            </div>
          )}
          
          <div className="overflow-y-auto max-h-[590px]">
            {lessons.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No lessons scheduled
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {sortedLessons.map((lesson) => {
                  const isSelected = selectedLesson?.id === lesson.id
                  
                  return (
                    <li
                      key={lesson.id}
                      onClick={async () => {
                        // Fetch full lesson details including payment/package info
                        try {
                          const { data: fullLesson } = await api.get(`/lessons/${lesson.id}`)
                          setSelectedLesson(fullLesson)
                        } catch (error) {
                          console.error('Error fetching lesson details:', error)
                          // Fallback to lesson from list if API call fails
                          setSelectedLesson(lesson)
                        }
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-indigo-100 border-l-4 border-indigo-700 pl-4 pr-4 py-3' 
                          : 'hover:bg-indigo-50 p-4 pl-[17px]'
                      }`}
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        {/* Name Column */}
                        <div className="col-span-3">
                          <p className="text-sm font-medium text-gray-900">
                            {lesson.student.firstName} {lesson.student.lastName}
                          </p>
                        </div>
                        
                        {/* Date Column */}
                        <div className="col-span-2">
                          <span className="text-sm text-gray-900">{formatDate(lesson.dateTime)}</span>
                        </div>
                        
                        {/* Time Column */}
                        <div className="col-span-2">
                          <span className="text-sm text-gray-900">{formatTime(lesson.dateTime, lesson.duration, lesson.allDay)}</span>
                        </div>
                        
                        {/* Subject Column */}
                        <div className="col-span-3">
                          <span className="text-sm text-gray-900">{lesson.subject || '-'}</span>
                        </div>
                        
                        {/* Paid Column */}
                        <div className="col-span-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            lesson.isPaid 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {lesson.isPaid ? 'Paid' : 'Unpaid'}
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

        {/* Lesson Details Panel - Takes 1 column */}
        <div className="bg-white rounded-lg shadow" style={{ height: '708px' }}>
          {selectedLesson ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedLesson.student.firstName} {selectedLesson.student.lastName}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedLesson.subject || '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditLesson}
                      className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit lesson"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleDeleteLesson}
                      className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete lesson"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2.5 overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
                {/* Date & Time */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</h3>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{formatDate(selectedLesson.dateTime)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{formatTime(selectedLesson.dateTime, selectedLesson.duration, selectedLesson.allDay)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Duration:</span>
                    <span className="text-gray-900">{selectedLesson.duration} minutes</span>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</h3>
                  
                  <div className="flex items-center gap-2 text-sm">
                    {selectedLesson.locationType === 'remote' ? (
                      <Video className="h-4 w-4 text-gray-400" />
                    ) : (
                      <MapPin className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-gray-900 capitalize">{selectedLesson.locationType}</span>
                  </div>
                  
                  {selectedLesson.locationType === 'remote' && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-gray-600">Link:</span>
                      {selectedLesson.link ? (
                        <a 
                          href={selectedLesson.link.startsWith('http://') || selectedLesson.link.startsWith('https://') ? selectedLesson.link : `https://${selectedLesson.link}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 break-all"
                        >
                          {selectedLesson.link}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">
                      ${parseFloat(selectedLesson.price).toFixed(2)}
                    </span>
                  </div>
                  {selectedLesson.paidAmount > 0 && (
                    <div className="text-sm ml-6">
                      <span className="text-gray-600">Paid: </span>
                      <span className={`font-medium ${
                        selectedLesson.paidAmount >= selectedLesson.price 
                          ? 'text-green-600' 
                          : 'text-yellow-600'
                      }`}>
                        ${selectedLesson.paidAmount.toFixed(2)}
                      </span>
                      {selectedLesson.paidAmount < selectedLesson.price && (
                        <span className="text-gray-500 ml-1">
                          (${(selectedLesson.price - selectedLesson.paidAmount).toFixed(2)} remaining)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment Information */}
                <div className="space-y-1.5 pt-2 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</h3>
                    {selectedLesson.status !== 'cancelled' && selectedLesson.status !== 'canceled' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await fetchPaymentsForStudent(selectedLesson.studentId)
                            setSelectedPaymentId('')
                            setShowLinkPaymentModal(true)
                          }}
                          className="px-2 py-1 text-xs font-medium rounded-md transition-colors bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                          title="Link a payment to this lesson"
                        >
                          Link Payment
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const newPaidStatus = !selectedLesson.isPaid
                              const { data: updatedLesson } = await api.patch(`/lessons/${selectedLesson.id}/payment-status`, {
                                isPaid: newPaidStatus
                              })
                              setSelectedLesson(updatedLesson)
                              await fetchLessons()
                              toast.success(newPaidStatus ? 'Lesson marked as paid' : 'Lesson marked as unpaid')
                            } catch (error) {
                              console.error('Error updating payment status:', error)
                              toast.error('Failed to update payment status')
                            }
                          }}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                            selectedLesson.isPaid
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {selectedLesson.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                      </div>
                    )}
                  </div>
                  {(selectedLesson.isPaid || selectedLesson.paidAmount > 0) ? (
                    <div className="text-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          selectedLesson.isPaid 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedLesson.isPaid ? 'Fully Paid' : 'Partially Paid'}
                        </span>
                      </div>
                      
                      {selectedLesson.package ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Covered by Package:</span>
                            <a
                              href={`#packages`}
                              onClick={(e) => {
                                e.preventDefault()
                                // Navigate to payments page with package focus
                                window.location.href = '/payments'
                              }}
                              className="text-indigo-600 hover:text-indigo-900 font-medium"
                            >
                              {selectedLesson.package.name}
                            </a>
                          </div>
                          <div className="text-xs text-gray-500 ml-6">
                            Purchased: {new Date(selectedLesson.package.purchasedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : selectedLesson.payment ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Covered by Payment:</span>
                            <a
                              href={`#payments`}
                              onClick={(e) => {
                                e.preventDefault()
                                // Navigate to payments page
                                window.location.href = '/payments'
                              }}
                              className="text-indigo-600 hover:text-indigo-900 font-medium"
                            >
                              ${selectedLesson.payment.amount.toFixed(2)} on {new Date(selectedLesson.payment.date).toLocaleDateString()}
                            </a>
                          </div>
                          {selectedLesson.payment.method && (
                            <div className="text-xs text-gray-500 ml-6">
                              Method: {selectedLesson.payment.method.charAt(0).toUpperCase() + selectedLesson.payment.method.slice(1)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {selectedLesson.isPaid ? (
                            <div>
                              <p>This lesson was marked as paid manually.</p>
                              <p className="text-xs mt-1">No payment or package is linked to this lesson.</p>
                            </div>
                          ) : (
                            <div>
                              <p>Payment information not available.</p>
                              <p className="text-xs mt-1">This lesson is not linked to a payment or package.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Unpaid
                      </span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedLesson.status === 'completed' ? 'bg-green-100 text-green-800' :
                    selectedLesson.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedLesson.status}
                  </span>
                </div>

                {/* Recurring Info */}
                {selectedLesson.isRecurring && (
                  <div className="space-y-1.5 pt-2 border-t">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recurring</h3>
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Frequency:</span>
                        <span className="text-gray-900 capitalize">{selectedLesson.recurringFrequency}</span>
                      </div>
                      {selectedLesson.recurringEndDate && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-600">Until:</span>
                          <span className="text-gray-900">{formatDate(selectedLesson.recurringEndDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</h3>
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-400 mt-0.5" />
                    <p className={`whitespace-pre-wrap ${selectedLesson.notes ? 'text-gray-900' : 'text-gray-400'}`}>
                      {selectedLesson.notes || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full p-8 text-center text-gray-500 text-sm">
              Select a lesson to view details
            </div>
          )}
        </div>
      </div>

      {/* Modal for Add/Edit Lesson */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <div className="bg-white">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {isEditing ? 'Edit Lesson' : 'New Lesson'}
                    </h3>
                  </div>
                  
                  <div className="px-6 py-4 space-y-1">
                    {/* Student */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Student <span className="text-red-500">*</span></label>
                      <div className="flex-1">
                        <select
                          required
                          value={formData.studentId}
                          onChange={(e) => handleStudentChange(e.target.value)}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                        >
                          <option value="">Select student</option>
                          {students.map(student => (
                            <option key={student.id} value={student.id}>
                              {student.firstName} {student.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600">Subject <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="e.g., Math"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* All Day */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600">All Day</label>
                      <input
                        type="checkbox"
                        checked={formData.allDay}
                        onChange={(e) => {
                          const isAllDay = e.target.checked
                          if (isAllDay) {
                            // Set to start of day
                            const date = formData.dateTime.split('T')[0] || new Date().toISOString().split('T')[0]
                            setFormData({
                              ...formData,
                              allDay: true,
                              dateTime: `${date}T00:00`,
                              endDateTime: `${date}T23:59`
                            })
                          } else {
                            // Set to current time
                            setFormData({
                              ...formData,
                              allDay: false,
                              dateTime: getCurrentDateTime(),
                              endDateTime: getEndDateTime(getCurrentDateTime())
                            })
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </div>

                    {/* Starts */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600">Starts</label>
                      <div className="flex gap-2 flex-1">
                        <input
                          type="date"
                          required
                          value={formData.dateTime.split('T')[0] || ''}
                          onChange={(e) => {
                            const date = e.target.value
                            const time = formData.dateTime.split('T')[1] || '09:00'
                            const newStart = formData.allDay ? `${date}T00:00` : `${date}T${time}`
                            setFormData({
                              ...formData,
                              dateTime: newStart,
                              endDateTime: formData.allDay ? `${date}T23:59` : getEndDateTime(newStart)
                            })
                          }}
                          disabled={formData.allDay && !formData.dateTime}
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                        />
                        {!formData.allDay && (
                          <TimePicker24
                            value={formData.dateTime.split('T')[1] || '09:00'}
                            onChange={(time) => {
                              const date = formData.dateTime.split('T')[0] || new Date().toISOString().split('T')[0]
                              const newStart = `${date}T${time}`
                              setFormData({
                                ...formData,
                                dateTime: newStart,
                                endDateTime: getEndDateTime(newStart)
                              })
                            }}
                            className="flex-1"
                          />
                        )}
                      </div>
                    </div>

                    {/* Ends */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600">Ends</label>
                      <div className="flex gap-2 flex-1">
                        <input
                          type="date"
                          required
                          value={formData.endDateTime.split('T')[0] || ''}
                          onChange={(e) => {
                            const date = e.target.value
                            const time = formData.endDateTime.split('T')[1] || '10:00'
                            const newEnd = formData.allDay ? `${date}T23:59` : `${date}T${time}`
                            setFormData({ ...formData, endDateTime: newEnd })
                          }}
                          disabled={formData.allDay && !formData.endDateTime}
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                        />
                        {!formData.allDay && (
                          <TimePicker24
                            value={formData.endDateTime.split('T')[1] || '10:00'}
                            onChange={(time) => {
                              const date = formData.endDateTime.split('T')[0] || formData.dateTime.split('T')[0] || new Date().toISOString().split('T')[0]
                              setFormData({ ...formData, endDateTime: `${date}T${time}` })
                            }}
                            className="flex-1"
                          />
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600">Location</label>
                      <select
                        value={formData.locationType}
                        onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      >
                        <option value="in-person">In Person</option>
                        <option value="remote">Video Call</option>
                      </select>
                    </div>

                    {/* Video Link */}
                    {formData.locationType === 'remote' && (
                      <div className="flex items-center py-2">
                        <label className="w-24 text-sm text-gray-600">Link</label>
                        <input
                          type="url"
                          value={formData.link}
                          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                          placeholder="https://..."
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                        />
                      </div>
                    )}

                    {/* Repeat */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600">Repeat</label>
                      <select
                        value={formData.isRecurring ? formData.recurringFrequency : 'never'}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === 'never') {
                            setFormData({ ...formData, isRecurring: false, recurringFrequency: 'weekly', recurringEndDate: '' })
                            setEndRepeatType('date')
                          } else {
                            setFormData({ ...formData, isRecurring: true, recurringFrequency: value })
                            // If switching to count mode, recalculate end date
                            if (endRepeatType === 'count' && formData.dateTime) {
                              const startDate = new Date(formData.dateTime)
                              let endDate = new Date(startDate)
                              const occurrences = numberOfClasses - 1
                              switch (value) {
                                case 'daily':
                                  endDate.setDate(endDate.getDate() + occurrences)
                                  break
                                case 'weekly':
                                  endDate.setDate(endDate.getDate() + (occurrences * 7))
                                  break
                                case 'monthly':
                                  endDate.setMonth(endDate.getMonth() + occurrences)
                                  break
                                case 'yearly':
                                  endDate.setFullYear(endDate.getFullYear() + occurrences)
                                  break
                              }
                              setFormData(prev => ({ ...prev, isRecurring: true, recurringFrequency: value, recurringEndDate: endDate.toISOString().split('T')[0] }))
                            }
                          }
                        }}
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      >
                        <option value="never">Never</option>
                        <option value="daily">Every Day</option>
                        <option value="weekly">Every Week</option>
                        <option value="monthly">Every Month</option>
                        <option value="yearly">Every Year</option>
                      </select>
                    </div>

                    {/* End Repeat */}
                    {formData.isRecurring && (
                      <div className="flex items-start py-2">
                        <label className="w-24 text-sm text-gray-600 pt-2">End Repeat</label>
                        <div className="flex-1 space-y-2">
                          <select
                            value={endRepeatType}
                            onChange={(e) => {
                              setEndRepeatType(e.target.value)
                              if (e.target.value === 'date') {
                                // Keep current date if set
                              } else if (e.target.value === 'count') {
                                setFormData({ ...formData, recurringEndDate: '' })
                              } else if (e.target.value === 'schoolYear') {
                                // Calculate end of school year (June 30)
                                const now = new Date()
                                let year = now.getFullYear()
                                if (now.getMonth() > 5) {
                                  year = year + 1
                                }
                                const schoolYearEnd = new Date(year, 5, 30)
                                setFormData({ ...formData, recurringEndDate: schoolYearEnd.toISOString().split('T')[0] })
                              }
                            }}
                            className="w-full border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                          >
                            <option value="date">Until (date)</option>
                            <option value="count">Number of classes</option>
                            <option value="schoolYear">Till end of school year</option>
                          </select>
                          {endRepeatType === 'date' && (
                            <input
                              type="date"
                              required
                              value={formData.recurringEndDate || ''}
                              onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                              className="w-full border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                            />
                          )}
                          {endRepeatType === 'count' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={numberOfClasses}
                                onChange={(e) => {
                                  const count = parseInt(e.target.value) || 1
                                  setNumberOfClasses(count)
                                  // Calculate end date based on frequency and count
                                  if (formData.dateTime && formData.recurringFrequency) {
                                    const startDate = new Date(formData.dateTime)
                                    const endDate = new Date(startDate)
                                    const frequency = formData.recurringFrequency
                                    const occurrences = count - 1
                                    switch (frequency) {
                                      case 'daily':
                                        endDate.setDate(endDate.getDate() + occurrences)
                                        break
                                      case 'weekly':
                                        endDate.setDate(endDate.getDate() + (occurrences * 7))
                                        break
                                      case 'monthly':
                                        endDate.setMonth(endDate.getMonth() + occurrences)
                                        break
                                      case 'yearly':
                                        endDate.setFullYear(endDate.getFullYear() + occurrences)
                                        break
                                    }
                                    setFormData({ ...formData, recurringEndDate: endDate.toISOString().split('T')[0] })
                                  }
                                }}
                                className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                                placeholder="Number of classes"
                              />
                              <span className="text-xs text-gray-500">classes</span>
                            </div>
                          )}
                          {endRepeatType === 'schoolYear' && (
                            <div className="text-xs text-gray-500 px-2">
                              Until June 30, {(() => {
                                const now = new Date()
                                let year = now.getFullYear()
                                if (now.getMonth() > 5) year = year + 1
                                return year
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600">Price</label>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.price}
                          onChange={(e) => {
                            const newPrice = parseFloat(e.target.value) || 0
                            setFormData({ ...formData, price: newPrice })
                          }}
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Notes */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes"
                        rows="3"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm resize-none"
                      />
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false)
                        setIsEditing(false)
                        resetForm()
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                    >
                      {isEditing ? 'Save Changes' : 'Schedule Lesson'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Options Modal */}
      {showRecurringOptions && (
        <div className="fixed z-20 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  {recurringAction === 'save' ? 'Update Recurring Lesson' : 'Delete Recurring Lesson'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {recurringAction === 'save' 
                    ? 'Do you want to update only this lesson or this and all future lessons?' 
                    : 'Do you want to delete only this lesson or this and all future lessons?'}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      if (recurringAction === 'save') {
                        executeSave(false)
                      } else {
                        executeDelete(false)
                      }
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:text-sm"
                  >
                    Only this lesson
                  </button>
                  <button
                    onClick={() => {
                      if (recurringAction === 'save') {
                        executeSave(true)
                      } else {
                        executeDelete(true)
                      }
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:text-sm"
                  >
                    This and all future lessons
                  </button>
                  <button
                    onClick={() => {
                      setShowRecurringOptions(false)
                      setRecurringAction(null)
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Payment Modal */}
      {showLinkPaymentModal && selectedLesson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Link Payment to Lesson</h3>
                <button
                  onClick={() => {
                    setShowLinkPaymentModal(false)
                    setSelectedPaymentId('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Payment
                  </label>
                  <select
                    value={selectedPaymentId}
                    onChange={(e) => setSelectedPaymentId(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- Select a payment --</option>
                    {availablePayments.map((payment) => (
                      <option key={payment.id} value={payment.id}>
                        ${payment.amount.toFixed(2)} - {new Date(payment.date).toLocaleDateString()} ({payment.method || 'other'})
                        {payment.notes && ` - ${payment.notes.substring(0, 30)}`}
                      </option>
                    ))}
                  </select>
                  {availablePayments.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">No payments found for this student</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => {
                      setShowLinkPaymentModal(false)
                      setSelectedPaymentId('')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedPaymentId) {
                        toast.error('Please select a payment')
                        return
                      }
                      try {
                        const { data: updatedLesson } = await api.patch(`/lessons/${selectedLesson.id}/link-payment`, {
                          paymentId: selectedPaymentId
                        })
                        setSelectedLesson(updatedLesson)
                        await fetchLessons()
                        setShowLinkPaymentModal(false)
                        setSelectedPaymentId('')
                        toast.success('Payment linked to lesson successfully')
                      } catch (error) {
                        console.error('Error linking payment:', error)
                        toast.error(error.response?.data?.message || 'Failed to link payment to lesson')
                      }
                    }}
                    disabled={!selectedPaymentId}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Link Payment
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
