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

const localizer = momentLocalizer(moment)

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
        price: selectedStudent.pricePerLesson || 0
      })
    } else {
      setFormData({ ...formData, studentId, subject: '', price: 0 })
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
      setStudents(data)
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
  }


  const handleEditLesson = () => {
    setIsEditing(true)
  }

  const handleDeleteLesson = () => {
    if (!selectedLesson) return
    
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
      if (!formData.studentId || !formData.dateTime || !formData.endDateTime || !formData.subject) {
        toast.error('Please fill in all required fields')
        return
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
          studentId: formData.studentId,
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
            submitData.recurringEndDate = new Date(formData.recurringEndDate).toISOString()
          }
        }

        await api.post('/lessons', submitData)
        toast.success('Lesson scheduled successfully')
        await fetchLessons()
        setShowModal(false)
        setSelectedLesson(null)
        resetForm()
      }
    } catch (error) {
      console.error('Save lesson error:', error)
      toast.error('Failed to save lesson')
    }
  }

  const executeSave = async (scope) => {
    try {
      const start = new Date(formData.dateTime)
      const end = new Date(formData.endDateTime)
      const duration = Math.round((end - start) / 60000)

      const submitData = {
        studentId: formData.studentId,
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
          submitData.recurringEndDate = new Date(formData.recurringEndDate).toISOString()
        }
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
      resetForm()
    } catch (error) {
      console.error('Update lesson error:', error)
      toast.error('Failed to update lesson')
    }
  }

  const executeDelete = async (scope) => {
    if (!selectedLesson) return
    
    try {
      if (scope === 'single') {
        await api.delete(`/lessons/${selectedLesson.id}`)
        toast.success('Lesson deleted successfully')
      } else if (scope === 'future') {
        await api.delete(`/lessons/${selectedLesson.id}/recurring-future`)
        toast.success('This and all future lessons deleted successfully')
      }
      
      await fetchLessons()
      setShowModal(false)
      setShowDetails(false)
      setSelectedLesson(null)
      setShowRecurringOptions(false)
      resetForm()
    } catch (error) {
      toast.error('Failed to delete lesson')
    }
  }

  // Transform lessons into calendar events
  const events = lessons.map(lesson => {
    const start = new Date(lesson.dateTime)
    const end = new Date(start.getTime() + lesson.duration * 60000)
    
    return {
      id: lesson.id,
      title: `${lesson.student.firstName} ${lesson.student.lastName} - ${lesson.subject}`,
      start,
      end,
      resource: lesson,
      allDay: lesson.allDay || false
    }
  })

  const handleSelectEvent = (event) => {
    // Handle both calendar events (event.resource) and direct lesson objects (event.lesson or just event)
    const lesson = event.resource || event.lesson || event
    setSelectedLesson(lesson)
    
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

  // Custom event styling
  const eventStyleGetter = (event) => {
    const isSelected = selectedLesson && event.resource && event.resource.id === selectedLesson.id
    
    return {
      style: {
        backgroundColor: isSelected ? '#4f46e5' : 'transparent',
        borderLeft: `3px solid #4f46e5`,
        borderRadius: '0',
        color: isSelected ? 'white' : '#4f46e5',
        display: 'block',
        fontSize: '0.75rem',
        padding: '1px 2px 1px 4px',
        fontWeight: isSelected ? '600' : '500',
        height: 'auto',
        minHeight: '18px'
      }
    }
  }

  const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateTime) => {
    return new Date(dateTime).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Get lessons for the current month
  const currentMonthLessons = lessons.filter(lesson => {
    const lessonDate = new Date(lesson.dateTime)
    const current = new Date(currentDate)
    return lessonDate.getMonth() === current.getMonth() && 
           lessonDate.getFullYear() === current.getFullYear()
  }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage your lessons</p>
        </div>
        <button
          onClick={handleScheduleLesson}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          Schedule Lesson
        </button>
      </div>

      {/* Calendar and Lessons List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="h-[600px]">
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              onDoubleClickEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              views={['month', 'week', 'day']}
              defaultView="month"
              date={currentDate}
              onNavigate={setCurrentDate}
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
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {new Date(currentDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{currentMonthLessons.length} lessons this month</p>
          </div>
          <div className="overflow-y-auto max-h-[540px]">
            {currentMonthLessons.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No lessons scheduled this month
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {currentMonthLessons.map((lesson) => {
                  const startTime = new Date(lesson.dateTime)
                  const endTime = new Date(startTime.getTime() + lesson.duration * 60000)
                  
                  return (
                    <li
                      key={lesson.id}
                      onDoubleClick={() => handleSelectEvent({ lesson })}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
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
                        <div className="flex-shrink-0">
                          {lesson.locationType === 'remote' ? (
                            <Video className="h-4 w-4 text-indigo-600" />
                          ) : (
                            <MapPin className="h-4 w-4 text-gray-400" />
                          )}
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
                <select
                  required
                  value={formData.studentId}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">Select student</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName}
                    </option>
                  ))}
                </select>
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
                <input
                  type={formData.allDay ? "date" : "datetime-local"}
                  value={formData.allDay ? formData.dateTime?.split('T')[0] : formData.dateTime}
                  onChange={(e) => {
                    const value = e.target.value
                    if (formData.allDay) {
                      setFormData({ ...formData, dateTime: `${value}T00:00`, endDateTime: `${value}T23:59` })
                    } else {
                      setFormData({ ...formData, dateTime: value, endDateTime: getEndDateTime(value) })
                    }
                  }}
                  className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                />
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
                <input
                  type={formData.allDay ? "date" : "datetime-local"}
                  value={formData.allDay ? formData.endDateTime?.split('T')[0] : formData.endDateTime}
                  onChange={(e) => {
                    const value = e.target.value
                    if (formData.allDay) {
                      setFormData({ ...formData, endDateTime: `${value}T23:59` })
                    } else {
                      setFormData({ ...formData, endDateTime: value })
                    }
                  }}
                  className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                />
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
                      href={selectedLesson.link}
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
                      } else {
                        setFormData({ ...formData, isRecurring: true, recurringFrequency: value })
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
                    <input
                      type="date"
                      value={formData.recurringEndDate ? formData.recurringEndDate.split('T')[0] : ''}
                      onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value ? `${e.target.value}T23:59:59` : '' })}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 mt-2"
                      placeholder="End repeat date"
                    />
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
                      required
                      value={formData.studentId}
                      onChange={(e) => handleStudentChange(e.target.value)}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="">Select student</option>
                      {students.map(student => (
                        <option key={student.id} value={student.id}>
                          {student.firstName} {student.lastName}
                        </option>
                      ))}
                    </select>
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
                    <input
                      type={formData.allDay ? "date" : "datetime-local"}
                      value={formData.allDay ? formData.dateTime?.split('T')[0] : formData.dateTime}
                      onChange={(e) => {
                        const value = e.target.value
                        if (formData.allDay) {
                          setFormData({ ...formData, dateTime: `${value}T00:00`, endDateTime: `${value}T23:59` })
                        } else {
                          setFormData({ ...formData, dateTime: value, endDateTime: getEndDateTime(value) })
                        }
                      }}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>

                  {/* End Date/Time */}
                  <div>
                    <div className="flex items-center gap-1.5 text-gray-600 mb-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide">Ends</span>
                    </div>
                    <input
                      type={formData.allDay ? "date" : "datetime-local"}
                      value={formData.allDay ? formData.endDateTime?.split('T')[0] : formData.endDateTime}
                      onChange={(e) => {
                        const value = e.target.value
                        if (formData.allDay) {
                          setFormData({ ...formData, endDateTime: `${value}T23:59` })
                        } else {
                          setFormData({ ...formData, endDateTime: value })
                        }
                      }}
                      className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                    />
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
                        } else {
                          setFormData({ ...formData, isRecurring: true, recurringFrequency: value })
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
                      <input
                        type="date"
                        value={formData.recurringEndDate}
                        onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                        className="w-full text-sm border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 mt-2"
                        placeholder="End date (optional)"
                      />
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
