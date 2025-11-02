import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Clock, User, MapPin, Calendar as CalendarIcon, Video, X, Plus, Trash2 } from 'lucide-react'
import { api } from '../utils/api'
import toast from 'react-hot-toast'

// Set Monday as the first day of the week
moment.updateLocale('en', {
  week: {
    dow: 1, // Monday is the first day of the week
  }
})

// Create a custom localizer with 24-hour format
const baseLocalizer = momentLocalizer(moment)
const localizer = {
  ...baseLocalizer,
  formats: {
    ...baseLocalizer.formats,
    timeGutterFormat: (date, culture, localizer) => {
      // Format time slots in 24-hour format (e.g., "09:00" instead of "9 AM")
      return moment(date).format('HH:mm')
    },
    eventTimeRangeFormat: ({ start }, culture, localizer) => {
      // Only show start time, no range
      return moment(start).format('HH:mm')
    },
    eventTimeRangeStartFormat: ({ start }, culture, localizer) => {
      return moment(start).format('HH:mm')
    },
    eventTimeRangeEndFormat: ({ end }, culture, localizer) => {
      return moment(end).format('HH:mm')
    }
  }
}

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
        className="flex-1 text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="self-center text-gray-500">:</span>
      <select
        value={minutes}
        onChange={handleMinuteChange}
        className="flex-1 text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
      >
        {Array.from({ length: 12 }, (_, i) => {
          const min = i * 5
          return <option key={min} value={min}>{String(min).padStart(2, '0')}</option>
        })}
      </select>
    </div>
  )
}

export function Calendar() {
  const location = useLocation()
  const [lessons, setLessons] = useState([])
  const [students, setStudents] = useState([])
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showRecurringOptions, setShowRecurringOptions] = useState(false)
  const [recurringAction, setRecurringAction] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState('month')
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
  const [manualStudentName, setManualStudentName] = useState('')
  const [useManualEntry, setUseManualEntry] = useState(false)
  const [endRepeatType, setEndRepeatType] = useState('date') // 'date', 'count', or 'schoolYear'
  const [numberOfClasses, setNumberOfClasses] = useState(10)

  // Helper functions
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
    if (studentId === 'manual') {
      setUseManualEntry(true)
      setFormData({ ...formData, studentId: '', subject: '', price: 0 })
    } else {
      setUseManualEntry(false)
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
        setFormData({ ...formData, studentId, subject: '', price: 0 })
      }
    }
  }

  // Refetch lessons when navigating to this page
  useEffect(() => {
    fetchLessons()
    fetchStudents()
  }, [location.pathname])

  useEffect(() => {
    // Refetch lessons when window gains focus (e.g., switching browser tabs)
    const handleFocus = () => {
      fetchLessons()
    }

    // Refetch lessons when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchLessons()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const fetchLessons = async () => {
    try {
      const { data } = await api.get('/lessons')
      setLessons(data)
    } catch (error) {
      toast.error('Failed to load lessons')
    }
  }

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students')
      // Sort students by first name
      const sorted = [...data].sort((a, b) => {
        const nameA = (a.firstName || '').toLowerCase()
        const nameB = (b.firstName || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
      setStudents(sorted)
    } catch (error) {
      toast.error('Failed to load students')
    }
  }

  const handleScheduleLesson = () => {
    const currentDateTime = getCurrentDateTime()
    setSelectedLesson(null)
    setFormData({
      studentId: '',
      dateTime: currentDateTime,
      endDateTime: getEndDateTime(currentDateTime),
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
    setShowModal(true)
  }

  const resetForm = () => {
    const currentDateTime = getCurrentDateTime()
    setFormData({
      studentId: '',
      dateTime: currentDateTime,
      endDateTime: getEndDateTime(currentDateTime),
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
    setUseManualEntry(false)
    setManualStudentName('')
    setEndRepeatType('date')
    setNumberOfClasses(10)
  }


  const handleEditLesson = () => {
    setIsEditing(true)
  }

  const handleDeleteLesson = () => {
    if (!selectedLesson) {
      toast.error('No lesson selected')
      return
    }
    
    if (selectedLesson.isRecurring && selectedLesson.recurringGroupId) {
      setRecurringAction('delete')
      setShowRecurringOptions(true)
    } else {
      if (window.confirm('Are you sure you want to delete this lesson?')) {
        executeDelete('single')
      }
    }
  }

  const handleSaveLesson = async () => {
    try {
      // If using manual entry, validate the name
      if (useManualEntry && !manualStudentName.trim()) {
        toast.error('Please enter a student name')
        return
      }

      // Validate required fields
      if ((!useManualEntry && !formData.studentId) || !formData.dateTime || !formData.endDateTime || !formData.subject) {
        toast.error('Please fill in all required fields')
        return
      }

      let finalStudentId = formData.studentId

      // If using manual entry, create the student first
      if (useManualEntry && manualStudentName.trim()) {
        try {
          // Parse the name (assuming "First Last" format)
          const nameParts = manualStudentName.trim().split(/\s+/)
          const firstName = nameParts[0] || manualStudentName.trim()
          // If only one word provided, use it as first name and set last name to a default
          const lastName = nameParts.slice(1).join(' ') || 'Student'

          const newStudent = await api.post('/students', {
            firstName,
            lastName
          })
          finalStudentId = newStudent.data.id
          // Refresh students list
          await fetchStudents()
        } catch (error) {
          console.error('Create student error:', error)
          const errorMessage = error.response?.data?.message || 
                              error.response?.data?.errors?.[0]?.msg || 
                              'Failed to create student'
          toast.error(errorMessage)
          return
        }
      }

      if (selectedLesson) {
        // Editing existing lesson from details panel
        if (selectedLesson.isRecurring && selectedLesson.recurringGroupId) {
          setRecurringAction('save')
          setShowRecurringOptions(true)
        } else {
          executeSave('single')
        }
      } else {
        // Creating new lesson from modal
        const start = new Date(formData.dateTime)
        const end = new Date(formData.endDateTime)
        const duration = Math.round((end - start) / 60000)

        const submitData = {
          studentId: finalStudentId,
          dateTime: start.toISOString(),
          duration,
          subject: formData.subject,
          price: parseFloat(formData.price),
          status: formData.status,
          locationType: formData.locationType,
          allDay: formData.allDay
        }

        if (formData.notes) submitData.notes = formData.notes
        if (formData.link) submitData.link = formData.link
        if (formData.isRecurring) {
          submitData.isRecurring = true
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
        }

        await api.post('/lessons', submitData)
        toast.success('Lesson scheduled successfully')
        await fetchLessons()
        setShowModal(false)
        setSelectedLesson(null)
        setUseManualEntry(false)
        setManualStudentName('')
        resetForm()
      }
    } catch (error) {
      console.error('Save lesson error:', error)
      toast.error('Failed to save lesson')
    }
  }

  const executeSave = async (scope) => {
    try {
      // If using manual entry, validate the name
      if (useManualEntry && !manualStudentName.trim()) {
        toast.error('Please enter a student name')
        return
      }

      let finalStudentId = formData.studentId

      // If using manual entry, create the student first
      if (useManualEntry && manualStudentName.trim()) {
        try {
          // Parse the name (assuming "First Last" format)
          const nameParts = manualStudentName.trim().split(/\s+/)
          const firstName = nameParts[0] || manualStudentName.trim()
          // If only one word provided, use it as first name and set last name to a default
          const lastName = nameParts.slice(1).join(' ') || 'Student'

          const newStudent = await api.post('/students', {
            firstName,
            lastName
          })
          finalStudentId = newStudent.data.id
          // Refresh students list
          await fetchStudents()
        } catch (error) {
          console.error('Create student error:', error)
          const errorMessage = error.response?.data?.message || 
                              error.response?.data?.errors?.[0]?.msg || 
                              'Failed to create student'
          toast.error(errorMessage)
          return
        }
      }

      const start = new Date(formData.dateTime)
      const end = new Date(formData.endDateTime)
      const duration = Math.round((end - start) / 60000)

      const submitData = {
        studentId: finalStudentId,
        dateTime: start.toISOString(),
        duration,
        subject: formData.subject,
        price: parseFloat(formData.price),
        status: formData.status,
        locationType: formData.locationType,
        allDay: formData.allDay
      }

      if (formData.notes) submitData.notes = formData.notes
      if (formData.link) submitData.link = formData.link
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

      if (scope === 'single') {
        await api.put(`/lessons/${selectedLesson.id}`, submitData)
        toast.success('Lesson updated successfully')
      } else if (scope === 'future') {
        await api.put(`/lessons/${selectedLesson.id}/recurring-future`, submitData)
        toast.success('This and all future lessons updated successfully')
      }

      await fetchLessons()
      setShowModal(false)
      setShowDetails(false)
      setSelectedLesson(null)
      setShowRecurringOptions(false)
      setUseManualEntry(false)
      setManualStudentName('')
      resetForm()
    } catch (error) {
      console.error('Update lesson error:', error)
      toast.error('Failed to update lesson')
    }
  }

  const executeDelete = async (scope) => {
    if (!selectedLesson) {
      toast.error('No lesson selected')
      return
    }
    
    try {
      const lessonId = selectedLesson.id
      
      if (scope === 'single') {
        await api.delete(`/lessons/${lessonId}`)
        toast.success('Lesson deleted successfully')
      } else if (scope === 'future') {
        await api.delete(`/lessons/${lessonId}/recurring-future`)
        toast.success('This and all future lessons deleted successfully')
      }
      
      await fetchLessons()
      setShowModal(false)
      setShowDetails(false)
      setSelectedLesson(null)
      setShowRecurringOptions(false)
      resetForm()
    } catch (error) {
      console.error('Delete lesson error:', error)
      toast.error(error.response?.data?.message || 'Failed to delete lesson')
    }
  }

  // Transform lessons into calendar events
  // react-big-calendar automatically filters events by date range, so we include all lessons
  const events = lessons.map(lesson => {
    const start = new Date(lesson.dateTime)
    const end = new Date(start.getTime() + lesson.duration * 60000)
    
    return {
      id: lesson.id,
      title: lesson.subject || 'Lesson',
      start,
      end,
      resource: lesson,
      allDay: lesson.allDay || false
    }
  }).filter(event => {
    // Ensure we have valid dates
    return event.start instanceof Date && !isNaN(event.start.getTime()) &&
           event.end instanceof Date && !isNaN(event.end.getTime())
  })

  // Custom month event renderer: show start time and truncate title
  const MonthEvent = ({ event }) => {
    const isAllDay = event.allDay
    const timeLabel = isAllDay
      ? ''
      : new Date(event.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    
    // Get lesson data for custom formatting
    const lesson = event.resource
    let displayText = event.title // Already just the subject from events mapping
    
    return (
      <div className="flex items-center gap-1 min-w-0 max-w-full" style={{ width: '100%' }}>
        {!isAllDay && (
          <span className="text-gray-700 shrink-0 text-xs">{timeLabel}</span>
        )}
        <span 
          className="truncate min-w-0 text-xs flex-1" 
          style={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%'
          }}
          title={event.title}
        >
          {displayText}
        </span>
      </div>
    )
  }

  // Custom day/week event renderer: show only start time and lesson name
  const DayWeekEvent = ({ event }) => {
    const isAllDay = event.allDay
    
    if (isAllDay) {
      return (
        <div className="flex items-center gap-1.5 min-w-0" style={{ width: '100%', padding: '2px 4px' }}>
          <span className="truncate min-w-0 text-xs flex-1 font-medium">
            {event.title}
          </span>
        </div>
      )
    }
    
    const startTime = new Date(event.start).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    })
    
    // Format: "09:30 - AP Physics" (only start time and lesson name)
    const displayText = `${startTime} - ${event.title}`
    
    return (
      <div className="flex items-center gap-1.5 min-w-0" style={{ width: '100%', padding: '2px 4px' }}>
        <span 
          className="truncate min-w-0 text-xs flex-1 font-medium" 
          style={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={displayText}
        >
          {displayText}
        </span>
      </div>
    )
  }

  const handleSelectEvent = (event) => {
    // Handle both calendar events (event.resource) and direct lesson objects (event.lesson or just event)
    const lesson = event.resource || event.lesson || event
    setSelectedLesson(lesson)
    setShowDetails(true)
    
    // Populate formData for editing
    const lessonDate = new Date(lesson.dateTime)
    const endDate = new Date(lessonDate.getTime() + lesson.duration * 60000)
    
    const formatDateTime = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    const recurringEndDate = lesson.recurringEndDate 
      ? new Date(lesson.recurringEndDate).toISOString().split('T')[0]
      : ''

    setFormData({
      studentId: lesson.studentId,
      dateTime: formatDateTime(lessonDate),
      endDateTime: formatDateTime(endDate),
      subject: lesson.subject,
      price: lesson.price,
      notes: lesson.notes || '',
      status: lesson.status,
      locationType: lesson.locationType || 'in-person',
      link: lesson.link || '',
      isRecurring: lesson.isRecurring || false,
      recurringFrequency: lesson.recurringFrequency || 'weekly',
      recurringEndDate: recurringEndDate,
      allDay: lesson.allDay || false
    })
    
    setShowModal(true)
  }

  const handleCloseDetails = () => {
    setShowDetails(false)
    setSelectedLesson(null)
    setIsEditing(false)
  }

  const handleSelectSlot = (slotInfo) => {
    // On double-click in month view, open add lesson modal with selected date
    if (slotInfo.action === 'doubleClick') {
      // Format the selected date/time
      const selectedDate = new Date(slotInfo.start)
      const formatDateTime = (date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
      }
      
      const startDateTime = formatDateTime(selectedDate)
      const endDateTime = getEndDateTime(startDateTime)
      
      // Open add lesson modal with pre-selected date
      setSelectedLesson(null)
      setFormData({
        studentId: '',
        dateTime: startDateTime,
        endDateTime: endDateTime,
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
      setShowModal(true)
      setIsEditing(false)
    }
  }

  // Custom event styling
  const eventStyleGetter = (event) => {
    const isSelected = selectedLesson && event.resource && event.resource.id === selectedLesson.id

    // Default styles (month view thin line look)
    let style = {
      backgroundColor: 'transparent',
      borderLeft: '3px solid #4338ca',
      borderRadius: '0',
      color: '#4338ca',
      display: 'block',
      fontSize: '0.75rem',
      padding: '1px 2px 1px 4px',
      fontWeight: '500',
      height: 'auto',
      minHeight: '18px',
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }

    // Week/Day view: fill block with light purple
    if (currentView === 'week' || currentView === 'day') {
      style = {
        ...style,
        backgroundColor: '#e0e7ff',
        color: '#4338ca',
        borderLeft: 'none'
      }
    }

    // Selected state emphasis
    if (isSelected) {
      style = { ...style, backgroundColor: '#e0e7ff', fontWeight: '600' }
    }

    return { className: isSelected ? 'rbc-selected-event' : '', style }
  }

  const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDate = (dateTime) => {
    return new Date(dateTime).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Get lessons for the current view period
  const getViewLessons = () => {
    const current = new Date(currentDate)
    
    if (currentView === 'day') {
      // Filter lessons for the current day
      return lessons.filter(lesson => {
        const lessonDate = new Date(lesson.dateTime)
        return lessonDate.getDate() === current.getDate() &&
               lessonDate.getMonth() === current.getMonth() &&
               lessonDate.getFullYear() === current.getFullYear()
      }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    } else if (currentView === 'week') {
      // Filter lessons for the current week
      const startOfWeek = new Date(current)
      const day = startOfWeek.getDay()
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Monday start
      startOfWeek.setDate(diff)
      startOfWeek.setHours(0, 0, 0, 0)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      
      return lessons.filter(lesson => {
        const lessonDate = new Date(lesson.dateTime)
        return lessonDate >= startOfWeek && lessonDate <= endOfWeek
      }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    } else {
      // Filter lessons for the current month (default for month view)
      return lessons.filter(lesson => {
        const lessonDate = new Date(lesson.dateTime)
        return lessonDate.getMonth() === current.getMonth() &&
               lessonDate.getFullYear() === current.getFullYear()
      }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    }
  }
  
  const currentViewLessons = getViewLessons()

  return (
    <div className="space-y-6">
      {/* Calendar and Lessons List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="h-[700px]">
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              selectable
              components={{ 
                month: { event: MonthEvent },
                week: { event: DayWeekEvent },
                day: { event: DayWeekEvent }
              }}
              onSelectEvent={(event) => {
                const lesson = event.resource || event.lesson || event
                setSelectedLesson(lesson)
                setShowDetails(true)
              }}
              onDoubleClickEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              eventPropGetter={eventStyleGetter}
              views={['month', 'week', 'day']}
              view={currentView}
              onView={(view) => {
                setCurrentView(view)
                setSelectedLesson(null)
              }}
              date={currentDate}
              onNavigate={(date) => {
                setCurrentDate(date)
                setSelectedLesson(null)
              }}
              scrollToTime={new Date(1970, 1, 1, 10, 0, 0)}
              style={{ height: '100%' }}
              popup
              showMultiDayTimes
              messages={{
                previous: '←',
                next: '→',
                today: 'Today'
              }}
            />
          </div>
        </div>

        {/* Lessons List - Takes 1 column */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {currentView === 'day' 
                  ? new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                  : currentView === 'week'
                  ? `Week of ${new Date(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : new Date(currentDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                }
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {currentViewLessons.length} {currentViewLessons.length === 1 ? 'lesson' : 'lessons'} 
                {currentView === 'day' ? ' today' : currentView === 'week' ? ' this week' : ' this month'}
              </p>
            </div>
            <button
              onClick={handleScheduleLesson}
              className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Schedule new lesson"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[640px]">
            {currentViewLessons.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No lessons scheduled {currentView === 'day' ? 'today' : currentView === 'week' ? 'this week' : 'this month'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {currentViewLessons.map((lesson) => {
                  const startTime = new Date(lesson.dateTime)
                  const endTime = new Date(startTime.getTime() + lesson.duration * 60000)
                  const isSelected = selectedLesson?.id === lesson.id
                  
                  return (
                    <li
                      key={lesson.id}
                      onClick={() => {
                        setSelectedLesson(lesson)
                        setShowDetails(true)
                      }}
                      onDoubleClick={() => handleSelectEvent({ lesson })}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-indigo-50 border-l-4 border-indigo-600 pl-4 pr-4 py-4' 
                          : 'hover:bg-gray-50 p-4'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {lesson.student.firstName} {lesson.student.lastName}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{lesson.subject}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <span>{formatDate(lesson.dateTime)}</span>
                            <span>•</span>
                            {lesson.allDay ? (
                              <span className="italic">All Day</span>
                            ) : (
                              <span>{formatTime(lesson.dateTime)} - {formatTime(endTime)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {lesson.locationType === 'remote' ? (
                            lesson.link && (
                              <a
                                href={lesson.link.startsWith('http://') || lesson.link.startsWith('https://') ? lesson.link : `https://${lesson.link}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-indigo-600 hover:text-indigo-900 p-1"
                                title="Join video call"
                              >
                                <Video className="h-4 w-4" />
                              </a>
                            )
                          ) : (
                            <div className="p-1" title="In person">
                              <MapPin className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedLesson(lesson)
                              handleDeleteLesson()
                            }}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete lesson"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Details Panel - Right Side */}
      {showDetails && (
        <div className="w-80 bg-white rounded-lg shadow-lg">
          <div className="sticky top-0 bg-indigo-600 text-white px-4 py-3 rounded-t-lg flex justify-between items-center">
            <h2 className="text-base font-semibold">
              {selectedLesson ? 'Lesson Details' : 'New Lesson'}
            </h2>
            <button
              onClick={handleCloseDetails}
              className="text-white hover:bg-indigo-700 rounded-full p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
            {/* Student */}
            <div>
              <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                <User className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Student {isEditing && <span className="text-red-500">*</span>}
                </span>
              </div>
              {isEditing ? (
                <>
                  <select
                    required={!useManualEntry}
                    value={useManualEntry ? 'manual' : formData.studentId}
                    onChange={(e) => handleStudentChange(e.target.value)}
                    className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 mb-2"
                  >
                    <option value="">Select student</option>
                    <option value="manual">+ Enter manually</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                      </option>
                    ))}
                  </select>
                  {useManualEntry && (
                    <input
                      type="text"
                      required
                      value={manualStudentName}
                      onChange={(e) => setManualStudentName(e.target.value)}
                      placeholder="Enter student name (e.g., John Doe)"
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  )}
                </>
              ) : selectedLesson ? (
                <>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedLesson.student.firstName} {selectedLesson.student.lastName}
                  </p>
                  {selectedLesson.student.phone && (
                    <p className="text-xs text-gray-600 mt-0.5">{selectedLesson.student.phone}</p>
                  )}
                </>
              ) : null}
            </div>

            {/* All-Day */}
            {isEditing && (
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.allDay}
                    onChange={(e) => {
                      const isAllDay = e.target.checked
                      const updates = { allDay: isAllDay }
                      if (isAllDay && formData.dateTime) {
                        const date = formData.dateTime.split('T')[0]
                        updates.dateTime = `${date}T00:00`
                        updates.endDateTime = `${date}T23:59`
                      } else if (!isAllDay && formData.dateTime) {
                        const currentTime = getCurrentDateTime()
                        updates.dateTime = currentTime
                        updates.endDateTime = getEndDateTime(currentTime)
                      }
                      setFormData({ ...formData, ...updates })
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  All-day event
                </label>
              </div>
            )}

            {/* Date & Time */}
            <div>
              <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                <CalendarIcon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  {isEditing ? 'Starts' : 'Date & Time'}
                </span>
              </div>
              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={formData.dateTime?.split('T')[0] || ''}
                    onChange={(e) => {
                      const date = e.target.value
                      const time = formData.dateTime?.split('T')[1] || '09:00'
                      const newDateTime = formData.allDay ? `${date}T00:00` : `${date}T${time}`
                      const newEndDateTime = formData.allDay ? `${date}T23:59` : getEndDateTime(newDateTime)
                      // Recalculate price if student and duration changed
                      const durationMinutes = formData.allDay ? 0 : Math.round((new Date(newEndDateTime) - new Date(newDateTime)) / 60000)
                      const newPrice = formData.studentId ? calculatePrice(formData.studentId, durationMinutes) : formData.price
                      setFormData({ 
                        ...formData, 
                        dateTime: newDateTime,
                        endDateTime: newEndDateTime,
                        price: newPrice
                      })
                    }}
                    className="flex-1 text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {!formData.allDay && (
                    <TimePicker24
                      value={formData.dateTime?.split('T')[1] || '09:00'}
                      onChange={(time) => {
                        const date = formData.dateTime?.split('T')[0] || new Date().toISOString().split('T')[0]
                        const newDateTime = `${date}T${time}`
                        const newEndDateTime = getEndDateTime(newDateTime)
                        // Recalculate price if student and duration changed
                        const durationMinutes = Math.round((new Date(newEndDateTime) - new Date(newDateTime)) / 60000)
                        const newPrice = formData.studentId ? calculatePrice(formData.studentId, durationMinutes) : formData.price
                        setFormData({ 
                          ...formData, 
                          dateTime: newDateTime,
                          endDateTime: newEndDateTime,
                          price: newPrice
                        })
                      }}
                      className="flex-1"
                    />
                  )}
                </div>
              ) : selectedLesson ? (
                <>
                  <p className="text-sm text-gray-900 font-medium">{formatDate(selectedLesson.dateTime)}</p>
                  {selectedLesson.allDay ? (
                    <p className="text-xs text-gray-600 italic mt-0.5">All Day</p>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-xs text-gray-600">
                        {formatTime(selectedLesson.dateTime)} - {formatTime(new Date(new Date(selectedLesson.dateTime).getTime() + selectedLesson.duration * 60000))}
                      </p>
                      <span className="text-xs text-gray-500">({selectedLesson.duration} min)</span>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* End Time */}
            {isEditing && (
              <div>
                <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide">Ends</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={formData.endDateTime?.split('T')[0] || ''}
                    onChange={(e) => {
                      const date = e.target.value
                      const time = formData.endDateTime?.split('T')[1] || '10:00'
                      const newEndDateTime = formData.allDay ? `${date}T23:59` : `${date}T${time}`
                      // Recalculate price when end date changes
                      const durationMinutes = formData.allDay ? 0 : Math.round((new Date(newEndDateTime) - new Date(formData.dateTime || newEndDateTime)) / 60000)
                      const newPrice = formData.studentId ? calculatePrice(formData.studentId, durationMinutes) : formData.price
                      setFormData({ ...formData, endDateTime: newEndDateTime, price: newPrice })
                    }}
                    className="flex-1 text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {!formData.allDay && (
                    <TimePicker24
                      value={formData.endDateTime?.split('T')[1] || '10:00'}
                      onChange={(time) => {
                        const date = formData.endDateTime?.split('T')[0] || formData.dateTime?.split('T')[0] || new Date().toISOString().split('T')[0]
                        const newEndDateTime = `${date}T${time}`
                        // Recalculate price when end time changes
                        const durationMinutes = Math.round((new Date(newEndDateTime) - new Date(formData.dateTime || newEndDateTime)) / 60000)
                        const newPrice = formData.studentId ? calculatePrice(formData.studentId, durationMinutes) : formData.price
                        setFormData({ ...formData, endDateTime: newEndDateTime, price: newPrice })
                      }}
                      className="flex-1"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Subject */}
            <div>
              <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                <span className="text-xs font-medium uppercase tracking-wide">
                  Subject {isEditing && <span className="text-red-500">*</span>}
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Subject"
                />
              ) : selectedLesson ? (
                <p className="text-sm text-gray-900 font-medium">{selectedLesson.subject}</p>
              ) : null}
            </div>

            {/* Location */}
            <div>
              <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Location</span>
              </div>
              {isEditing ? (
                <>
                  <select
                    value={formData.locationType}
                    onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                    className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="in-person">In Person</option>
                    <option value="remote">Video Call</option>
                  </select>
                  {formData.locationType === 'remote' && (
                    <input
                      type="url"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 mt-2"
                      placeholder="https://"
                    />
                  )}
                </>
              ) : selectedLesson ? (
                <>
                  <p className="text-sm text-gray-900 capitalize">
                    {selectedLesson.locationType === 'remote' ? (
                      <span className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5" />
                        Video Call
                      </span>
                    ) : (
                      'In Person'
                    )}
                  </p>
                  {selectedLesson.link && (
                    <a
                      href={selectedLesson.link.startsWith('http://') || selectedLesson.link.startsWith('https://') ? selectedLesson.link : `https://${selectedLesson.link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 underline mt-1 block break-all"
                    >
                      {selectedLesson.link}
                    </a>
                  )}
                </>
              ) : null}
            </div>

            {/* Recurring */}
            <div>
              <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                <span className="text-xs font-medium uppercase tracking-wide">Repeat</span>
              </div>
              {isEditing ? (
                <>
                  <select
                    value={formData.isRecurring ? formData.recurringFrequency : 'never'}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === 'never') {
                        setFormData({ ...formData, isRecurring: false })
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
                    className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="never">Never</option>
                    <option value="daily">Every Day</option>
                    <option value="weekly">Every Week</option>
                    <option value="monthly">Every Month</option>
                    <option value="yearly">Every Year</option>
                  </select>
                  {formData.isRecurring && (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs font-medium text-gray-600 mb-1.5">End repeat</div>
                      <select
                        value={endRepeatType}
                        onChange={(e) => {
                          setEndRepeatType(e.target.value)
                          // Reset recurringEndDate when changing type
                          if (e.target.value === 'date') {
                            // Keep current date if set
                          } else if (e.target.value === 'count') {
                            setFormData({ ...formData, recurringEndDate: '' })
                          } else if (e.target.value === 'schoolYear') {
                            // Calculate end of school year (June 30)
                            const now = new Date()
                            let year = now.getFullYear()
                            // If we're past June, use next year
                            if (now.getMonth() > 5) {
                              year = year + 1
                            }
                            const schoolYearEnd = new Date(year, 5, 30) // June 30 (month is 0-indexed)
                            setFormData({ ...formData, recurringEndDate: schoolYearEnd.toISOString().split('T')[0] })
                          }
                        }}
                        className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="date">Until (date)</option>
                        <option value="count">Number of classes</option>
                        <option value="schoolYear">Till end of school year</option>
                      </select>
                      {endRepeatType === 'date' && (
                        <input
                          type="date"
                          value={formData.recurringEndDate ? formData.recurringEndDate.split('T')[0] : ''}
                          onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value ? `${e.target.value}T23:59:59` : '' })}
                          className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder="End repeat date"
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
                                let endDate = new Date(startDate)
                                const frequency = formData.recurringFrequency
                                
                                // Calculate date after (count - 1) occurrences (since first is the start date)
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
                            className="flex-1 text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Number of classes"
                          />
                          <span className="text-xs text-gray-500">classes</span>
                        </div>
                      )}
                      {endRepeatType === 'schoolYear' && (
                        <div className="text-xs text-gray-500">
                          Until June 30, {(() => {
                            const now = new Date()
                            let year = now.getFullYear()
                            if (now.getMonth() > 5) year = year + 1
                            return year
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : selectedLesson && selectedLesson.isRecurring ? (
                <p className="text-sm text-gray-900 capitalize">
                  {selectedLesson.recurringFrequency}
                  {selectedLesson.recurringEndDate && (
                    <span className="text-xs text-gray-600 ml-1">
                      until {formatDate(selectedLesson.recurringEndDate)}
                    </span>
                  )}
                </p>
              ) : !isEditing ? (
                <p className="text-sm text-gray-500">Never</p>
              ) : null}
            </div>

            {/* Notes */}
            <div>
              <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                <span className="text-xs font-medium uppercase tracking-wide">Notes</span>
              </div>
              {isEditing ? (
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 resize-none"
                  placeholder="Add notes..."
                />
              ) : selectedLesson && selectedLesson.notes ? (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-900 whitespace-pre-wrap leading-relaxed">{selectedLesson.notes}</p>
                </div>
              ) : !isEditing ? (
                <p className="text-xs text-gray-500">No notes</p>
              ) : null}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveLesson}
                    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      if (selectedLesson) {
                        setIsEditing(false)
                      } else {
                        handleCloseDetails()
                      }
                    }}
                    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleEditLesson}
                    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-indigo-600 shadow-sm text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDeleteLesson}
                    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-red-600 shadow-sm text-sm font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Lesson Modal */}
      {showModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white">
                <div className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center">
                  <h2 className="text-base font-semibold">
                    {selectedLesson ? 'Edit Lesson' : 'New Lesson'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setSelectedLesson(null); resetForm(); }}
                    className="text-white hover:bg-indigo-700 rounded-full p-1 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
                  {/* Student */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                      <User className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Student <span className="text-red-500">*</span>
                      </span>
                    </div>
                    <select
                      required={!useManualEntry}
                      value={useManualEntry ? 'manual' : formData.studentId}
                      onChange={(e) => handleStudentChange(e.target.value)}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 mb-2"
                    >
                      <option value="">Select student</option>
                      <option value="manual">+ Enter manually</option>
                      {students.map(student => (
                        <option key={student.id} value={student.id}>
                          {student.firstName} {student.lastName}
                        </option>
                      ))}
                    </select>
                    {useManualEntry && (
                      <input
                        type="text"
                        required
                        value={manualStudentName}
                        onChange={(e) => setManualStudentName(e.target.value)}
                        placeholder="Enter student name (e.g., John Doe)"
                        className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    )}
                  </div>

                  {/* All-Day */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={formData.allDay}
                        onChange={(e) => {
                          const isAllDay = e.target.checked
                          const updates = { allDay: isAllDay }
                          if (isAllDay && formData.dateTime) {
                            const date = formData.dateTime.split('T')[0]
                            updates.dateTime = `${date}T00:00`
                            updates.endDateTime = `${date}T23:59`
                          } else if (!isAllDay && formData.dateTime) {
                            const currentTime = getCurrentDateTime()
                            updates.dateTime = currentTime
                            updates.endDateTime = getEndDateTime(currentTime)
                          }
                          setFormData({ ...formData, ...updates })
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      All-day event
                    </label>
                  </div>

                  {/* Date & Time - Starts */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                      <CalendarIcon className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Starts</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={formData.dateTime?.split('T')[0] || ''}
                        onChange={(e) => {
                          const date = e.target.value
                          const time = formData.dateTime?.split('T')[1] || '09:00'
                          const newDateTime = formData.allDay ? `${date}T00:00` : `${date}T${time}`
                          const newEndDateTime = formData.allDay ? `${date}T23:59` : getEndDateTime(newDateTime)
                          // Recalculate price when start date changes
                          const durationMinutes = formData.allDay ? 0 : Math.round((new Date(newEndDateTime) - new Date(newDateTime)) / 60000)
                          const newPrice = formData.studentId ? calculatePrice(formData.studentId, durationMinutes) : formData.price
                          setFormData({ 
                            ...formData, 
                            dateTime: newDateTime,
                            endDateTime: newEndDateTime,
                            price: newPrice
                          })
                        }}
                        className="flex-1 text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      {!formData.allDay && (
                        <TimePicker24
                          value={formData.dateTime?.split('T')[1] || '09:00'}
                          onChange={(time) => {
                            const date = formData.dateTime?.split('T')[0] || new Date().toISOString().split('T')[0]
                            const newDateTime = `${date}T${time}`
                            const newEndDateTime = getEndDateTime(newDateTime)
                            // Recalculate price when start time changes
                            const durationMinutes = Math.round((new Date(newEndDateTime) - new Date(newDateTime)) / 60000)
                            const newPrice = formData.studentId ? calculatePrice(formData.studentId, durationMinutes) : formData.price
                            setFormData({ 
                              ...formData, 
                              dateTime: newDateTime,
                              endDateTime: newEndDateTime,
                              price: newPrice
                            })
                          }}
                          className="flex-1"
                        />
                      )}
                    </div>
                  </div>

                  {/* End Date/Time */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide">Ends</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={formData.endDateTime?.split('T')[0] || ''}
                        onChange={(e) => {
                          const date = e.target.value
                          const time = formData.endDateTime?.split('T')[1] || '10:00'
                          const newEndDateTime = formData.allDay ? `${date}T23:59` : `${date}T${time}`
                          // Recalculate price when end date changes
                          const durationMinutes = formData.allDay ? 0 : Math.round((new Date(newEndDateTime) - new Date(formData.dateTime || newEndDateTime)) / 60000)
                          const newPrice = formData.studentId ? calculatePrice(formData.studentId, durationMinutes) : formData.price
                          setFormData({ ...formData, endDateTime: newEndDateTime, price: newPrice })
                        }}
                        className="flex-1 text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      {!formData.allDay && (
                        <TimePicker24
                          value={formData.endDateTime?.split('T')[1] || '10:00'}
                          onChange={(time) => {
                            const date = formData.endDateTime?.split('T')[0] || formData.dateTime?.split('T')[0] || new Date().toISOString().split('T')[0]
                            const newEndDateTime = `${date}T${time}`
                            // Recalculate price when end time changes
                            const durationMinutes = Math.round((new Date(newEndDateTime) - new Date(formData.dateTime || newEndDateTime)) / 60000)
                            const newPrice = formData.studentId ? calculatePrice(formData.studentId, durationMinutes) : formData.price
                            setFormData({ ...formData, endDateTime: newEndDateTime, price: newPrice })
                          }}
                          className="flex-1"
                        />
                      )}
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide">
                        Subject <span className="text-red-500">*</span>
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="Subject"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                      <MapPin className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Location</span>
                    </div>
                    <select
                      value={formData.locationType}
                      onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="in-person">In Person</option>
                      <option value="remote">Video Call</option>
                    </select>
                    {formData.locationType === 'remote' && (
                      <input
                        type="url"
                        value={formData.link}
                        onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                        className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 mt-2"
                        placeholder="https://"
                      />
                    )}
                  </div>

                  {/* Recurring */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide">Repeat</span>
                    </div>
                    <select
                      value={formData.isRecurring ? formData.recurringFrequency : 'never'}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === 'never') {
                          setFormData({ ...formData, isRecurring: false })
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
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="never">Never</option>
                      <option value="daily">Every Day</option>
                      <option value="weekly">Every Week</option>
                      <option value="monthly">Every Month</option>
                      <option value="yearly">Every Year</option>
                    </select>
                    {formData.isRecurring && (
                      <div className="mt-2 space-y-2">
                        <div className="text-xs font-medium text-gray-600 mb-1.5">End repeat</div>
                        <select
                          value={endRepeatType}
                          onChange={(e) => {
                            setEndRepeatType(e.target.value)
                            // Reset recurringEndDate when changing type
                            if (e.target.value === 'date') {
                              // Keep current date if set
                            } else if (e.target.value === 'count') {
                              setFormData({ ...formData, recurringEndDate: '' })
                            } else if (e.target.value === 'schoolYear') {
                              // Calculate end of school year (June 30)
                              const now = new Date()
                              let year = now.getFullYear()
                              // If we're past June, use next year
                              if (now.getMonth() > 5) {
                                year = year + 1
                              }
                              const schoolYearEnd = new Date(year, 5, 30) // June 30 (month is 0-indexed)
                              setFormData({ ...formData, recurringEndDate: schoolYearEnd.toISOString().split('T')[0] })
                            }
                          }}
                          className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                        >
                          <option value="date">Until (date)</option>
                          <option value="count">Number of classes</option>
                          <option value="schoolYear">Till end of school year</option>
                        </select>
                        {endRepeatType === 'date' && (
                          <input
                            type="date"
                            value={formData.recurringEndDate || ''}
                            onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                            className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="End repeat date"
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
                                  let endDate = new Date(startDate)
                                  const frequency = formData.recurringFrequency
                                  
                                  // Calculate date after (count - 1) occurrences (since first is the start date)
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
                              className="flex-1 text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                              placeholder="Number of classes"
                            />
                            <span className="text-xs text-gray-500">classes</span>
                          </div>
                        )}
                        {endRepeatType === 'schoolYear' && (
                          <div className="text-xs text-gray-500">
                            Until June 30, {(() => {
                              const now = new Date()
                              let year = now.getFullYear()
                              if (now.getMonth() > 5) year = year + 1
                              return year
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide">Notes</span>
                    </div>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 resize-none"
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-gray-200 space-y-2">
                  <button
                    type="button"
                    onClick={handleSaveLesson}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setSelectedLesson(null); resetForm(); }}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  {selectedLesson && (
                    <button
                      type="button"
                      onClick={handleDeleteLesson}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Lesson
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Options Modal */}
      {showRecurringOptions && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {recurringAction === 'save' ? 'Update Recurring Lesson' : 'Delete Recurring Lesson'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  This is a recurring lesson. What would you like to {recurringAction === 'save' ? 'update' : 'delete'}?
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      if (recurringAction === 'save') {
                        executeSave('single')
                      } else {
                        executeDelete('single')
                      }
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                  >
                    Only this lesson
                  </button>
                  <button
                    onClick={() => {
                      if (recurringAction === 'save') {
                        executeSave('future')
                      } else {
                        executeDelete('future')
                      }
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                  >
                    This and all future lessons
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowRecurringOptions(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
