import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function Lessons() {
  const [activeTab, setActiveTab] = useState('upcoming') // 'upcoming' or 'past'
  const [allLessons, setAllLessons] = useState([]) // Store all lessons
  const [lessons, setLessons] = useState([])
  const [sortedLessons, setSortedLessons] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'dateTime', direction: 'asc' })
  const [selectedStudent, setSelectedStudent] = useState('') // Filter by student
  const [selectedSubject, setSelectedSubject] = useState('') // Filter by subject
  const [dateFrom, setDateFrom] = useState('') // Filter by date range - start
  const [dateTo, setDateTo] = useState('') // Filter by date range - end
  const [students, setStudents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingLesson, setEditingLesson] = useState(null)
  const [isViewMode, setIsViewMode] = useState(false) // true for past lessons (read-only)
  const [showRecurringOptions, setShowRecurringOptions] = useState(false)
  const [recurringAction, setRecurringAction] = useState(null) // 'save' or 'delete'
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
    // iCal-style options
    allDay: false
  }))
  
  // Helper function to get current date/time in the format datetime-local expects (24h format)
  const getCurrentDateTime = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  
  // Helper function to calculate end time (1 hour after start by default)
  const getEndDateTime = (startDateTime) => {
    if (!startDateTime) return ''
    const start = new Date(startDateTime)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // Add 1 hour
    const year = end.getFullYear()
    const month = String(end.getMonth() + 1).padStart(2, '0')
    const day = String(end.getDate()).padStart(2, '0')
    const hours = String(end.getHours()).padStart(2, '0')
    const minutes = String(end.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  
  // Helper function to prefill student data when selected
  const handleStudentChange = (studentId) => {
    const selectedStudent = students.find(s => s.id === studentId)
    if (selectedStudent) {
      const studentName = `${selectedStudent.firstName} ${selectedStudent.lastName}`
      const subjectText = selectedStudent.subject 
        ? `${studentName} - ${selectedStudent.subject}` 
        : studentName
      
      setFormData({
        ...formData,
        studentId,
        subject: subjectText,
        price: selectedStudent.pricePerLesson || formData.price
      })
    } else {
      setFormData({ ...formData, studentId, subject: '' })
    }
  }

  useEffect(() => {
    fetchLessons()
    fetchStudents()
  }, [])

  // Filter lessons when tab, filters, or lessons change
  useEffect(() => {
    filterLessonsByTab()
  }, [activeTab, allLessons, selectedStudent, selectedSubject, dateFrom, dateTo])

  const fetchLessons = async () => {
    try {
      const { data } = await api.get('/lessons')
      setAllLessons(data)
    } catch (error) {
      toast.error('Failed to load lessons')
    }
  }

  const filterLessonsByTab = () => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
    
    let filtered = []
    let defaultSort = { key: 'dateTime', direction: 'asc' }
    
    if (activeTab === 'upcoming') {
      // Show only future lessons
      filtered = allLessons.filter(lesson => {
        const lessonDate = new Date(lesson.dateTime)
        
        // For all-day events, compare dates only (should be upcoming if today or later)
        // For timed events, compare full timestamp
        let isUpcoming
        if (lesson.allDay) {
          const lessonDayStart = new Date(lessonDate.getFullYear(), lessonDate.getMonth(), lessonDate.getDate())
          isUpcoming = lessonDayStart >= todayStart
        } else {
          isUpcoming = lessonDate >= now
        }
        
        // Apply student filter if selected
        const matchesStudent = !selectedStudent || lesson.studentId === selectedStudent
        
        // Apply subject filter if selected
        const matchesSubject = !selectedSubject || lesson.subject.toLowerCase().includes(selectedSubject.toLowerCase())
        
        // Apply date range filter if set
        let matchesDateRange = true
        if (dateFrom) {
          const fromDate = new Date(dateFrom)
          fromDate.setHours(0, 0, 0, 0)
          matchesDateRange = matchesDateRange && lessonDate >= fromDate
        }
        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999)
          matchesDateRange = matchesDateRange && lessonDate <= toDate
        }
        
        return isUpcoming && matchesStudent && matchesSubject && matchesDateRange
      })
      // Sort by date, earliest first
      filtered.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
      defaultSort = { key: 'dateTime', direction: 'asc' }
    } else {
      // Show past lessons from last 2 years with filters applied
      filtered = allLessons.filter(lesson => {
        const lessonDate = new Date(lesson.dateTime)
        
        // For all-day events, compare dates only (should be past if before today)
        // For timed events, compare full timestamp
        let isPast
        if (lesson.allDay) {
          const lessonDayStart = new Date(lessonDate.getFullYear(), lessonDate.getMonth(), lessonDate.getDate())
          isPast = lessonDayStart < todayStart && lessonDayStart >= twoYearsAgo
        } else {
          isPast = lessonDate < now && lessonDate >= twoYearsAgo
        }
        
        // Apply student filter if selected
        const matchesStudent = !selectedStudent || lesson.studentId === selectedStudent
        
        // Apply subject filter if selected
        const matchesSubject = !selectedSubject || lesson.subject.toLowerCase().includes(selectedSubject.toLowerCase())
        
        // Apply date range filter if set
        let matchesDateRange = true
        if (dateFrom) {
          const fromDate = new Date(dateFrom)
          fromDate.setHours(0, 0, 0, 0)
          matchesDateRange = matchesDateRange && lessonDate >= fromDate
        }
        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999)
          matchesDateRange = matchesDateRange && lessonDate <= toDate
        }
        
        return isPast && matchesStudent && matchesSubject && matchesDateRange
      })
      // Sort by date, most recent first
      filtered.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
      defaultSort = { key: 'dateTime', direction: 'desc' }
    }
    
    setLessons(filtered)
    setSortedLessons(filtered)
    setSortConfig(defaultSort)
  }

  const sortData = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }

    const sorted = [...lessons].sort((a, b) => {
      let aValue, bValue

      // Special handling for student name
      if (key === 'studentName') {
        aValue = `${a.student.firstName} ${a.student.lastName}`.toLowerCase()
        bValue = `${b.student.firstName} ${b.student.lastName}`.toLowerCase()
      } else if (key === 'dateTime') {
        aValue = new Date(a.dateTime).getTime()
        bValue = new Date(b.dateTime).getTime()
      } else {
        aValue = a[key]
        bValue = b[key]
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = ''
      if (bValue === null || bValue === undefined) bValue = ''

      // Convert to lowercase for string comparison
      if (typeof aValue === 'string') aValue = aValue.toLowerCase()
      if (typeof bValue === 'string') bValue = bValue.toLowerCase()

      if (aValue < bValue) {
        return direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return direction === 'asc' ? 1 : -1
      }
      return 0
    })

    setSortedLessons(sorted)
    setSortConfig({ key, direction })
  }

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) {
      return <span className="ml-1 text-gray-400">⇅</span>
    }
    return sortConfig.direction === 'asc' ? 
      <span className="ml-1">↑</span> : 
      <span className="ml-1">↓</span>
  }

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students')
      setStudents(data)
    } catch (error) {
      toast.error('Failed to load students')
    }
  }

  // Get unique subjects from all lessons
  const getUniqueSubjects = () => {
    const subjects = allLessons
      .map(lesson => lesson.subject)
      .filter(subject => subject) // Remove empty subjects
    return [...new Set(subjects)].sort()
  }

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedStudent('')
    setSelectedSubject('')
    setDateFrom('')
    setDateTo('')
  }

  // Set filters to show only today's lessons
  const filterToday = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayString = `${year}-${month}-${day}`
    
    setDateFrom(todayString)
    setDateTo(todayString)
  }

  // Check if any filter is active
  const hasActiveFilters = selectedStudent || selectedSubject || dateFrom || dateTo

  const handleEdit = (lesson) => {
    setEditingLesson(lesson)
    
    // Set view mode if this is a past lesson
    setIsViewMode(activeTab === 'past')
    
    // Format datetime for datetime-local input
    const lessonDateTime = new Date(lesson.dateTime)
    const year = lessonDateTime.getFullYear()
    const month = String(lessonDateTime.getMonth() + 1).padStart(2, '0')
    const day = String(lessonDateTime.getDate()).padStart(2, '0')
    const hours = String(lessonDateTime.getHours()).padStart(2, '0')
    const minutes = String(lessonDateTime.getMinutes()).padStart(2, '0')
    const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`
    
    // Calculate end datetime from start + duration
    const endDateTime = new Date(lessonDateTime.getTime() + lesson.duration * 60 * 1000)
    const endYear = endDateTime.getFullYear()
    const endMonth = String(endDateTime.getMonth() + 1).padStart(2, '0')
    const endDay = String(endDateTime.getDate()).padStart(2, '0')
    const endHours = String(endDateTime.getHours()).padStart(2, '0')
    const endMinutes = String(endDateTime.getMinutes()).padStart(2, '0')
    const formattedEndDateTime = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`
    
    // Format recurring end date if it exists
    let formattedRecurringEndDate = ''
    if (lesson.recurringEndDate) {
      const endDate = new Date(lesson.recurringEndDate)
      const rEndYear = endDate.getFullYear()
      const rEndMonth = String(endDate.getMonth() + 1).padStart(2, '0')
      const rEndDay = String(endDate.getDate()).padStart(2, '0')
      formattedRecurringEndDate = `${rEndYear}-${rEndMonth}-${rEndDay}`
    }
    
    setFormData({
      studentId: lesson.studentId,
      dateTime: formattedDateTime,
      endDateTime: formattedEndDateTime,
      subject: lesson.subject,
      price: lesson.price,
      notes: lesson.notes || '',
      status: lesson.status,
      locationType: lesson.locationType || 'in-person',
      link: lesson.link || '',
      isRecurring: lesson.isRecurring || false,
      recurringFrequency: lesson.recurringFrequency || 'weekly',
      recurringEndDate: formattedRecurringEndDate,
      // iCal-style options
      allDay: lesson.allDay || false
    })
    setShowModal(true)
  }

  const handleDeleteClick = (lesson = null) => {
    const lessonToDelete = lesson || editingLesson
    if (!lessonToDelete) return
    
    // If deleting from table (lesson parameter provided), set it as editing lesson
    if (lesson) {
      setEditingLesson(lesson)
    }
    
    // Check if this is part of a recurring series
    if (lessonToDelete.isRecurring && lessonToDelete.recurringGroupId) {
      setRecurringAction('delete')
      setShowRecurringOptions(true)
    } else {
      // Not recurring, just confirm and delete
      if (window.confirm('Are you sure you want to delete this lesson?')) {
        executeDelete('single', lessonToDelete)
      }
    }
  }

  const executeDelete = async (scope, lesson = null) => {
    const lessonToDelete = lesson || editingLesson
    if (!lessonToDelete) return
    
    try {
      if (scope === 'single') {
        await api.delete(`/lessons/${lessonToDelete.id}`)
        toast.success('Lesson deleted successfully')
      } else if (scope === 'future') {
        await api.delete(`/lessons/${lessonToDelete.id}/recurring-future`)
        toast.success('This and all future lessons deleted successfully')
      }
      
      fetchLessons()
      setShowModal(false)
      setShowRecurringOptions(false)
      setEditingLesson(null)
      resetForm()
    } catch (error) {
      toast.error('Failed to delete lesson')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Check if editing a recurring lesson
    if (editingLesson && editingLesson.isRecurring && editingLesson.recurringGroupId) {
      setRecurringAction('save')
      setShowRecurringOptions(true)
    } else {
      executeSave('single')
    }
  }

  const executeSave = async (scope) => {
    let submitData = null
    try {
      // Validate required fields
      if (!formData.dateTime) {
        toast.error('Start date and time are required')
        return
      }
      if (!formData.endDateTime) {
        toast.error('End date and time are required')
        return
      }
      if (!formData.studentId) {
        toast.error('Please select a student')
        return
      }
      
      // Calculate duration in minutes from start and end times
      const startTime = new Date(formData.dateTime)
      const endTime = new Date(formData.endDateTime)
      const duration = Math.round((endTime - startTime) / (1000 * 60)) // Duration in minutes
      
      if (duration <= 0) {
        toast.error('End time must be after start time')
        return
      }
      
      // Convert datetime-local value to ISO string
      submitData = {
        studentId: formData.studentId,
        dateTime: startTime.toISOString(),
        duration: duration,
        subject: formData.subject,
        price: parseFloat(formData.price),
        status: formData.status,
        locationType: formData.locationType || 'in-person'
      }
      
      // Only add notes if they exist
      if (formData.notes) {
        submitData.notes = formData.notes
      }
      
      // Only add link if remote and it exists
      if (submitData.locationType === 'remote' && formData.link) {
        submitData.link = formData.link
      }
      
      // Add iCal-style options
      if (formData.allDay !== undefined) submitData.allDay = formData.allDay
      
      if (editingLesson) {
        // When editing recurring lesson with "future" scope, include end date
        if (scope === 'future' && editingLesson.isRecurring && formData.recurringEndDate) {
          submitData.recurringEndDate = new Date(formData.recurringEndDate).toISOString()
        }
        
        // Check if converting to recurring
        if (!editingLesson.isRecurring && formData.isRecurring && formData.recurringEndDate) {
          submitData.isRecurring = true
          submitData.recurringFrequency = formData.recurringFrequency
          submitData.recurringEndDate = new Date(formData.recurringEndDate).toISOString()
        }
        
        // Check if converting recurring to single
        if (editingLesson.isRecurring && !formData.isRecurring) {
          submitData.isRecurring = false
        }
        
        // Update existing lesson
        if (scope === 'single') {
          const response = await api.put(`/lessons/${editingLesson.id}`, submitData)
          if (response.data.message) {
            toast.success(response.data.message)
          } else if (!editingLesson.isRecurring && formData.isRecurring) {
            toast.success('Lesson converted to recurring series successfully')
          } else if (editingLesson.isRecurring && !formData.isRecurring) {
            toast.success('Lesson converted to single lesson successfully')
          } else {
            toast.success('Lesson updated successfully')
          }
        } else if (scope === 'future') {
          // Include recurring settings when updating future lessons
          const futureUpdateData = { ...submitData }
          if (formData.isRecurring && formData.recurringFrequency) {
            futureUpdateData.recurringFrequency = formData.recurringFrequency
          }
          if (formData.recurringEndDate) {
            futureUpdateData.recurringEndDate = new Date(formData.recurringEndDate).toISOString()
          }
          const response = await api.put(`/lessons/${editingLesson.id}/recurring-future`, futureUpdateData)
          if (response.data.message) {
            toast.success(response.data.message)
          } else {
            toast.success('This and all future lessons updated successfully')
          }
        }
      } else {
        // Create new lesson(s)
        if (formData.isRecurring && formData.recurringEndDate) {
          submitData.recurringEndDate = new Date(formData.recurringEndDate).toISOString()
          submitData.recurringFrequency = formData.recurringFrequency
          submitData.isRecurring = true
        } else {
          // For non-recurring lessons, don't send these fields at all
          delete submitData.recurringFrequency
          delete submitData.recurringEndDate
          delete submitData.isRecurring
        }
        
        console.log('Posting lesson with data:', submitData)
        await api.post('/lessons', submitData)
        
        if (formData.isRecurring) {
          toast.success('Recurring lessons scheduled successfully')
        } else {
          toast.success('Lesson scheduled successfully')
        }
      }
      
      fetchLessons()
      setShowModal(false)
      setShowRecurringOptions(false)
      setEditingLesson(null)
      resetForm()
    } catch (error) {
      console.error('Save lesson error:', error)
      console.error('Error response:', error.response?.data)
      console.error('Submit data was:', submitData)
      
      // Handle validation errors
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errors = error.response.data.errors.map(e => e.msg).join(', ')
        toast.error(`Validation error: ${errors}`)
      } else {
        const errorMessage = error.response?.data?.message 
          || error.message 
          || 'Failed to save lesson'
        toast.error(errorMessage)
      }
    }
  }

  const resetForm = () => {
    setEditingLesson(null)
    setIsViewMode(false)
    setShowRecurringOptions(false)
    setRecurringAction(null)
    const startDateTime = getCurrentDateTime()
    setFormData({
      studentId: '',
      dateTime: startDateTime,
      endDateTime: getEndDateTime(startDateTime),
      subject: '',
      price: 0,
      notes: '',
      status: 'scheduled',
      locationType: 'in-person',
      link: '',
      isRecurring: false,
      recurringFrequency: 'weekly',
      recurringEndDate: '',
      // iCal-style options
      allDay: false
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lessons</h1>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === 'upcoming' ? 'Scheduled future lessons' : 'History from the past 2 years'}
          </p>
        </div>
        <button
          onClick={() => { 
            resetForm(); 
            setShowModal(true); 
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Schedule Lesson
        </button>
      </div>

      {/* Filters - Available for both tabs */}
      <div className="bg-gray-50 px-3 py-2 rounded space-y-2">
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
            {/* Student Filter */}
            <select
              id="studentFilter"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Students</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.firstName} {student.lastName}
                </option>
              ))}
            </select>

            {/* Subject Filter */}
            <select
              id="subjectFilter"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Subjects</option>
              {getUniqueSubjects().map(subject => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>

            {/* Date From */}
            <input
              type="date"
              id="dateFrom"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="Date from"
              className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-indigo-500 focus:border-indigo-500"
            />

            {/* Date To */}
            <input
              type="date"
              id="dateTo"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Date to"
              className="block w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <button
            onClick={filterToday}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded whitespace-nowrap"
          >
            Today
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`${
              activeTab === 'upcoming'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`${
              activeTab === 'past'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Past Lessons
          </button>
        </nav>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => sortData('studentName')}
              >
                <div className="flex items-center">
                  Name
                  <SortIcon column="studentName" />
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => sortData('dateTime')}
              >
                <div className="flex items-center">
                  Date
                  <SortIcon column="dateTime" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => sortData('subject')}
              >
                <div className="flex items-center">
                  Subject
                  <SortIcon column="subject" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedLessons.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                  {activeTab === 'upcoming' 
                    ? hasActiveFilters
                      ? 'No lessons found matching the selected filters' 
                      : 'No upcoming lessons scheduled'
                    : 'No past lessons found from the last 2 years'}
                </td>
              </tr>
            ) : (
              sortedLessons.map((lesson) => {
              const startTime = new Date(lesson.dateTime);
              const endTime = new Date(startTime.getTime() + lesson.duration * 60000);
              
              const formatDate = (date) => {
                return date.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
              };
              
              const formatTime = (date) => {
                return date.toLocaleString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
              };

              return (
                <tr 
                  key={lesson.id} 
                  className="hover:bg-gray-50"
                >
                  <td 
                    onClick={() => handleEdit(lesson)}
                    className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                  >
                    {lesson.student.firstName} {lesson.student.lastName}
                  </td>
                  <td 
                    onClick={() => handleEdit(lesson)}
                    className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                  >
                    {formatDate(startTime)}
                  </td>
                  <td 
                    onClick={() => handleEdit(lesson)}
                    className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                  >
                    {lesson.allDay ? (
                      <span className="text-gray-600 italic">All Day</span>
                    ) : (
                      `${formatTime(startTime)} - ${formatTime(endTime)}`
                    )}
                  </td>
                  <td 
                    onClick={() => handleEdit(lesson)}
                    className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 cursor-pointer"
                  >
                    {lesson.subject}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClick(lesson)
                      }}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="Delete lesson"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full z-50 relative">
              {isViewMode ? (
                // Read-only view for past lessons
                <div>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Lesson Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Student</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {editingLesson?.student.firstName} {editingLesson?.student.lastName}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Subject</label>
                          <p className="mt-1 text-sm text-gray-900">{formData.subject}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Price</label>
                          <p className="mt-1 text-sm text-gray-900">${parseFloat(formData.price).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Date</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {new Date(editingLesson?.dateTime).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Time</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {editingLesson?.allDay ? (
                              <span className="text-gray-600 italic">All Day</span>
                            ) : (
                              <>
                                {new Date(editingLesson?.dateTime).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })} - {new Date(new Date(editingLesson?.dateTime).getTime() + editingLesson?.duration * 60000).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Duration</label>
                        <p className="mt-1 text-sm text-gray-900">{editingLesson?.duration} minutes</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Location Type</label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">{formData.locationType}</p>
                      </div>
                      {formData.link && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Video Call Link</label>
                          <a 
                            href={formData.link.startsWith('http://') || formData.link.startsWith('https://') ? formData.link : `https://${formData.link}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-1 text-sm text-indigo-600 hover:text-indigo-800 underline break-all"
                          >
                            {formData.link}
                          </a>
                        </div>
                      )}
                      {formData.notes && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Notes</label>
                          <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{formData.notes}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          formData.status === 'completed' ? 'bg-green-100 text-green-800' :
                          formData.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {formData.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse sm:justify-between">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this past lesson?')) {
                          handleDeleteClick()
                        }
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Delete Lesson
                    </button>
                  </div>
                </div>
              ) : (
                // Editable form for upcoming lessons - iCal style
                <form onSubmit={handleSubmit}>
                <div className="bg-white">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingLesson ? 'Edit Lesson' : 'New Lesson'}
                    </h3>
                  </div>
                  
                  <div className="px-6 py-4 space-y-1">
                    {/* Student */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Student</label>
                      <div className="flex-1">
                        <select
                          required
                          value={formData.studentId}
                          onChange={(e) => handleStudentChange(e.target.value)}
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

                    {/* Subject & Price */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Subject</label>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          required
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="e.g., Math, Physics"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-600">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            className="w-20 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Location</label>
                      <div className="flex-1 space-y-2">
                        <select
                          required
                          value={formData.locationType}
                          onChange={(e) => setFormData({ ...formData, locationType: e.target.value, link: e.target.value === 'in-person' ? '' : formData.link })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                        >
                          <option value="in-person">In Person</option>
                          <option value="remote">Video Call</option>
                        </select>
                        {formData.locationType === 'remote' && (
                          <input
                            type="url"
                            placeholder="Add video call link"
                            value={formData.link}
                            onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                            className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm text-indigo-600"
                          />
                        )}
                      </div>
                    </div>

                    {/* All-day toggle */}
                    <div className="flex items-center py-2">
                      <label className="w-24 text-sm text-gray-600"></label>
                      <div className="flex-1">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            id="allDay"
                            checked={formData.allDay}
                            onChange={(e) => {
                              const isAllDay = e.target.checked
                              if (isAllDay) {
                                // Convert to all-day: set start to 00:00 and end to 23:59
                                const startDate = formData.dateTime.split('T')[0]
                                const endDate = formData.endDateTime.split('T')[0]
                                setFormData({ 
                                  ...formData, 
                                  allDay: true,
                                  dateTime: `${startDate}T00:00`,
                                  endDateTime: `${endDate}T23:59`
                                })
                              } else {
                                // Convert to timed event: keep dates but add current time
                                const now = new Date()
                                const hours = String(now.getHours()).padStart(2, '0')
                                const minutes = String(now.getMinutes()).padStart(2, '0')
                                const startDate = formData.dateTime.split('T')[0]
                                const startTime = `${startDate}T${hours}:${minutes}`
                                setFormData({ 
                                  ...formData, 
                                  allDay: false,
                                  dateTime: startTime,
                                  endDateTime: getEndDateTime(startTime)
                                })
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="ml-2 text-sm text-gray-900">All-day</span>
                        </label>
                      </div>
                    </div>

                    {/* Starts */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Starts</label>
                      <div className="flex-1">
                        <input
                          type={formData.allDay ? "date" : "datetime-local"}
                          required
                          value={formData.allDay ? formData.dateTime.split('T')[0] : formData.dateTime}
                          onChange={(e) => {
                            const newValue = formData.allDay ? `${e.target.value}T00:00` : e.target.value
                            setFormData({ ...formData, dateTime: newValue })
                            if (formData.endDateTime && new Date(newValue) >= new Date(formData.endDateTime)) {
                              setFormData({ ...formData, dateTime: newValue, endDateTime: getEndDateTime(newValue) })
                            }
                          }}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    {/* Ends */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Ends</label>
                      <div className="flex-1">
                        <input
                          type={formData.allDay ? "date" : "datetime-local"}
                          required
                          value={formData.allDay ? formData.endDateTime.split('T')[0] : formData.endDateTime}
                          onChange={(e) => {
                            const newValue = formData.allDay ? `${e.target.value}T23:59` : e.target.value
                            setFormData({ ...formData, endDateTime: newValue })
                          }}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    {/* Repeat */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Repeat</label>
                      <div className="flex-1 space-y-3">
                        <select
                          value={formData.isRecurring ? formData.recurringFrequency : 'none'}
                          onChange={(e) => {
                            if (e.target.value === 'none') {
                              setFormData({ ...formData, isRecurring: false, recurringEndDate: '' })
                            } else {
                              setFormData({ ...formData, isRecurring: true, recurringFrequency: e.target.value })
                            }
                          }}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                        >
                          <option value="none">Never</option>
                          <option value="daily">Every Day</option>
                          <option value="weekly">Every Week</option>
                          <option value="monthly">Every Month</option>
                          <option value="yearly">Every Year</option>
                        </select>
                        
                        {formData.isRecurring && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">End Repeat:</span>
                            <input
                              type="date"
                              required={formData.isRecurring}
                              value={formData.recurringEndDate}
                              onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                              className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                            />
                          </div>
                        )}
                        
                        {!formData.isRecurring && editingLesson && editingLesson.isRecurring && (
                          <p className="text-xs text-red-600">
                            This will remove the lesson from the recurring series
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="flex items-start py-2">
                      <label className="w-24 text-sm text-gray-600 pt-2">Notes</label>
                      <div className="flex-1">
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm resize-none"
                          placeholder="Add notes..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse sm:justify-between">
                  <div className="sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      {editingLesson ? 'Save Changes' : 'Schedule'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                  {editingLesson && (
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Delete Lesson
                    </button>
                  )}
                </div>
              </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recurring Options Modal */}
      {showRecurringOptions && (
        <div className="fixed z-20 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full z-50 relative">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  {recurringAction === 'delete' ? 'Delete Recurring Lesson' : 'Edit Recurring Lesson'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  This lesson is part of a recurring series. What would you like to do?
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (recurringAction === 'delete') {
                        executeDelete('single')
                      } else {
                        executeSave('single')
                      }
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:text-sm"
                  >
                    {recurringAction === 'delete' ? 'Delete only this lesson' : 'Save only this lesson'}
                  </button>
                  <button
                    onClick={() => {
                      if (recurringAction === 'delete') {
                        executeDelete('future')
                      } else {
                        executeSave('future')
                      }
                    }}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:text-sm"
                  >
                    {recurringAction === 'delete' ? 'Delete this and all future lessons' : 'Save this and all future lessons'}
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
    </div>
  )
}

