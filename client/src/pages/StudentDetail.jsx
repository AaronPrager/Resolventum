import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { ArrowLeft, Phone, Mail, Calendar as CalendarIcon, Clock, DollarSign, MapPin, Video, FileText, BookOpen, Save, X, Link as LinkIcon, Upload, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'

export function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [lessons, setLessons] = useState([])
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('past') // 'past' or 'future'
  const [editedNotes, setEditedNotes] = useState('')
  const [editedHomework, setEditedHomework] = useState('')
  const [originalNotes, setOriginalNotes] = useState('')
  const [originalHomework, setOriginalHomework] = useState('')
  const [notesFiles, setNotesFiles] = useState([])
  const [homeworkFiles, setHomeworkFiles] = useState([])
  const [savingNotes, setSavingNotes] = useState(false)
  const [savingHomework, setSavingHomework] = useState(false)

  useEffect(() => {
    fetchStudent()
  }, [id])

  // Parse homework from notes if it exists
  const parseHomeworkFromNotes = (notes) => {
    if (!notes) return ''
    const homeworkMatch = notes.match(/---HOMEWORK---\n(.*)/s)
    return homeworkMatch ? homeworkMatch[1].trim() : ''
  }

  const fetchStudent = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/students/${id}`)
      setStudent(data)
      // Lessons are already included and sorted by dateTime desc
      setLessons(data.lessons || [])
      // Select the first future lesson if available, otherwise first past lesson
      const now = new Date()
      const futureLessons = (data.lessons || []).filter(lesson => new Date(lesson.dateTime) >= now)
      const pastLessons = (data.lessons || []).filter(lesson => new Date(lesson.dateTime) < now)
      
      if (pastLessons.length > 0) {
        // Sort past descending (latest first)
        const sortedPast = [...pastLessons].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
        const lessonWithHomework = { ...sortedPast[0], homework: parseHomeworkFromNotes(sortedPast[0].notes) }
        setSelectedLesson(lessonWithHomework)
        setActiveTab('past')
      } else if (futureLessons.length > 0) {
        // Sort future ascending (next first)
        const sortedFuture = [...futureLessons].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
        const lessonWithHomework = { ...sortedFuture[0], homework: parseHomeworkFromNotes(sortedFuture[0].notes) }
        setSelectedLesson(lessonWithHomework)
        setActiveTab('future')
      }
    } catch (error) {
      console.error('Error fetching student:', error)
      toast.error('Failed to load student details')
      navigate('/students')
    } finally {
      setLoading(false)
    }
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

  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatTime = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatDuration = (minutes) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`
    } else if (hours > 0) {
      return `${hours}h`
    } else {
      return `${mins}m`
    }
  }

  // Filter and sort lessons based on active tab
  const getFilteredAndSortedLessons = () => {
    const now = new Date()
    const futureLessons = lessons.filter(lesson => new Date(lesson.dateTime) >= now)
    const pastLessons = lessons.filter(lesson => new Date(lesson.dateTime) < now)

    if (activeTab === 'future') {
      // Sort future ascending (next first)
      return [...futureLessons].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    } else {
      // Sort past descending (latest first)
      return [...pastLessons].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
    }
  }

  const filteredLessons = getFilteredAndSortedLessons()
  const nowForCount = new Date()
  const futureCount = lessons.filter(lesson => new Date(lesson.dateTime) >= nowForCount).length
  const pastCount = lessons.filter(lesson => new Date(lesson.dateTime) < nowForCount).length

  // Initialize edit state when lesson is selected
  useEffect(() => {
    if (selectedLesson) {
      // Use academicNotes for Extended Info (not the regular notes field)
      const academicNotesValue = selectedLesson.academicNotes || ''
      setEditedNotes(academicNotesValue)
      setOriginalNotes(academicNotesValue)
      // Extract homework from academicNotes if it exists (using a delimiter)
      const homeworkValue = selectedLesson.homework || parseHomeworkFromNotes(selectedLesson.academicNotes || '')
      setEditedHomework(homeworkValue)
      setOriginalHomework(homeworkValue)
      setNotesFiles([])
      setHomeworkFiles([])
    }
  }, [selectedLesson])

  // Check if notes have changed
  const notesChanged = editedNotes !== originalNotes || notesFiles.length > 0

  // Check if homework has changed
  const homeworkChanged = editedHomework !== originalHomework || homeworkFiles.length > 0

  const handleSaveNotes = async () => {
    if (!selectedLesson) return

    try {
      setSavingNotes(true)
      // Get current homework value (don't change it)
      const currentHomework = selectedLesson.homework || parseHomeworkFromNotes(selectedLesson.academicNotes || '')
      // Combine academic notes with homework delimiter
      const academicNotesWithHomework = editedNotes + (currentHomework ? `\n\n---HOMEWORK---\n${currentHomework}` : '')
      
      // Check if we have files to upload
      const hasFiles = notesFiles && notesFiles.length > 0
      
      if (hasFiles) {
        // Use FormData for file uploads
        const formData = new FormData()
        formData.append('academicNotes', academicNotesWithHomework)
        formData.append('studentId', selectedLesson.studentId)
        formData.append('dateTime', selectedLesson.dateTime)
        formData.append('duration', selectedLesson.duration.toString())
        formData.append('subject', selectedLesson.subject)
        formData.append('price', selectedLesson.price.toString())
        formData.append('locationType', selectedLesson.locationType)
        if (selectedLesson.link) {
          formData.append('link', selectedLesson.link)
        }
        
        // Append notes files only
        if (notesFiles && notesFiles.length > 0) {
          notesFiles.forEach((file) => {
            formData.append('notesFiles', file)
          })
        }
        
        const { data } = await api.put(`/lessons/${selectedLesson.id}`, formData)
        
        // Clear file arrays after successful upload
        setNotesFiles([])
        
        // Update original notes to reflect saved state
        setOriginalNotes(editedNotes)
        
        // Update the lesson in the lessons array
        const updatedLesson = { ...data, homework: currentHomework }
        const updatedLessons = lessons.map(lesson => 
          lesson.id === selectedLesson.id ? updatedLesson : lesson
        )
        setLessons(updatedLessons)
        setSelectedLesson(updatedLesson)
      } else {
        // No files, use regular JSON request
        const updateData = {
          academicNotes: academicNotesWithHomework,
          // Keep all other fields the same
          studentId: selectedLesson.studentId,
          dateTime: selectedLesson.dateTime,
          duration: selectedLesson.duration,
          subject: selectedLesson.subject,
          price: selectedLesson.price,
          locationType: selectedLesson.locationType,
          link: selectedLesson.link
        }

        const { data } = await api.put(`/lessons/${selectedLesson.id}`, updateData)
        
        // Update original notes to reflect saved state
        setOriginalNotes(editedNotes)
        
        // Update the lesson in the lessons array
        const updatedLesson = { ...data, homework: currentHomework }
        const updatedLessons = lessons.map(lesson => 
          lesson.id === selectedLesson.id ? updatedLesson : lesson
        )
        setLessons(updatedLessons)
        setSelectedLesson(updatedLesson)
      }
      
      toast.success('Academic notes saved successfully')
    } catch (error) {
      console.error('Error updating academic notes:', error)
      toast.error('Failed to save academic notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleSaveHomework = async () => {
    if (!selectedLesson) return

    try {
      setSavingHomework(true)
      // Get current academic notes value (don't change it)
      const currentAcademicNotes = selectedLesson.academicNotes && selectedLesson.academicNotes.includes('---HOMEWORK---')
        ? selectedLesson.academicNotes.split('---HOMEWORK---')[0].trim()
        : (selectedLesson.academicNotes || '')
      // Combine academic notes with homework delimiter
      const academicNotesWithHomework = currentAcademicNotes + (editedHomework ? `\n\n---HOMEWORK---\n${editedHomework}` : '')
      
      // Check if we have files to upload
      const hasFiles = homeworkFiles && homeworkFiles.length > 0
      
      if (hasFiles) {
        // Use FormData for file uploads
        const formData = new FormData()
        formData.append('academicNotes', academicNotesWithHomework)
        formData.append('studentId', selectedLesson.studentId)
        formData.append('dateTime', selectedLesson.dateTime)
        formData.append('duration', selectedLesson.duration.toString())
        formData.append('subject', selectedLesson.subject)
        formData.append('price', selectedLesson.price.toString())
        formData.append('locationType', selectedLesson.locationType)
        if (selectedLesson.link) {
          formData.append('link', selectedLesson.link)
        }
        
        // Append homework files only
        if (homeworkFiles && homeworkFiles.length > 0) {
          homeworkFiles.forEach((file) => {
            formData.append('homeworkFiles', file)
          })
        }
        
        const { data } = await api.put(`/lessons/${selectedLesson.id}`, formData)
        
        // Clear file arrays after successful upload
        setHomeworkFiles([])
        
        // Update original homework to reflect saved state
        setOriginalHomework(editedHomework)
        
        // Update the lesson in the lessons array
        const updatedLesson = { ...data, homework: editedHomework }
        const updatedLessons = lessons.map(lesson => 
          lesson.id === selectedLesson.id ? updatedLesson : lesson
        )
        setLessons(updatedLessons)
        setSelectedLesson(updatedLesson)
      } else {
        // No files, use regular JSON request
        const updateData = {
          academicNotes: academicNotesWithHomework,
          // Keep all other fields the same
          studentId: selectedLesson.studentId,
          dateTime: selectedLesson.dateTime,
          duration: selectedLesson.duration,
          subject: selectedLesson.subject,
          price: selectedLesson.price,
          locationType: selectedLesson.locationType,
          link: selectedLesson.link
        }

        const { data } = await api.put(`/lessons/${selectedLesson.id}`, updateData)
        
        // Update original homework to reflect saved state
        setOriginalHomework(editedHomework)
        
        // Update the lesson in the lessons array
        const updatedLesson = { ...data, homework: editedHomework }
        const updatedLessons = lessons.map(lesson => 
          lesson.id === selectedLesson.id ? updatedLesson : lesson
        )
        setLessons(updatedLessons)
        setSelectedLesson(updatedLesson)
      }
      
      toast.success('Homework saved successfully')
    } catch (error) {
      console.error('Error updating homework:', error)
      // Check for Google Drive connection requirement
      if (error.response?.data?.code === 'GOOGLE_DRIVE_NOT_CONNECTED' || error.response?.data?.requiresGoogleDrive) {
        toast.error('Google Drive connection required. Please connect Google Drive in your account settings to upload files.', {
          duration: 5000
        })
        setTimeout(() => {
          if (window.confirm('Would you like to go to Account Settings to connect Google Drive now?')) {
            window.location.href = '/account'
          }
        }, 2000)
      } else {
        toast.error(error.response?.data?.message || 'Failed to save homework')
      }
    } finally {
      setSavingHomework(false)
    }
  }

  const handleFileUpload = (e, type) => {
    const files = Array.from(e.target.files)
    if (type === 'notes') {
      setNotesFiles(prev => [...prev, ...files])
    } else {
      setHomeworkFiles(prev => [...prev, ...files])
    }
  }

  const removeFile = (index, type) => {
    if (type === 'notes') {
      setNotesFiles(prev => prev.filter((_, i) => i !== index))
    } else {
      setHomeworkFiles(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleDeleteStoredFile = async (fileType, fileIndex) => {
    if (!selectedLesson) return

    try {
      const { data } = await api.delete(`/lessons/${selectedLesson.id}/files`, {
        data: { fileType, fileIndex }
      })
      
      // Update the lesson with the new data
      const updatedLesson = { ...data, homework: parseHomeworkFromNotes(data.notes || '') }
      setSelectedLesson(updatedLesson)
      
      // Update in lessons array
      const updatedLessons = lessons.map(lesson => 
        lesson.id === selectedLesson.id ? updatedLesson : lesson
      )
      setLessons(updatedLessons)
      
      toast.success('File deleted successfully')
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error(error.response?.data?.message || 'Failed to delete file')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Student not found</p>
          <button
            onClick={() => navigate('/students')}
            className="mt-4 text-indigo-600 hover:text-indigo-900"
          >
            Back to Students
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ marginLeft: 'calc(-1 * max(1.5rem, calc((100vw - 1280px) / 2)))', marginRight: 'calc(-1 * max(1.5rem, calc((100vw - 1280px) / 2)))', width: '100vw', maxWidth: '100vw' }}>
      <div className="max-w-[2560px] mx-auto px-6 sm:px-8 lg:px-12 py-10">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/students')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Students</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {student.firstName} {student.lastName}
          </h1>
        </div>

        {/* Basic Info Section */}
        <div className="bg-white rounded-lg shadow mb-8 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {student.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <a href={`tel:${student.phone}`} className="text-indigo-600 hover:text-indigo-900">
                    {student.phone}
                  </a>
                </div>
              </div>
            )}
            {student.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <a href={`mailto:${student.email}`} className="text-indigo-600 hover:text-indigo-900">
                    {student.email}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content: Lessons List and Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Lessons List */}
          <div className="bg-white rounded-lg shadow flex flex-col" style={{ minHeight: '600px' }}>
            <div className="p-5 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Lessons</h2>
              {/* Tabs */}
              <div className="flex gap-2 border-b border-gray-200 -mb-5">
                <button
                  onClick={() => {
                    setActiveTab('past')
                    // Select first past lesson when switching to past tab
                    const now = new Date()
                    const pastLessons = lessons.filter(lesson => new Date(lesson.dateTime) < now)
                    if (pastLessons.length > 0) {
                      const sorted = [...pastLessons].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
                      const lessonWithHomework = { ...sorted[0], homework: parseHomeworkFromNotes(sorted[0].notes) }
                      setSelectedLesson(lessonWithHomework)
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'past'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Past ({pastCount})
                </button>
                <button
                  onClick={() => {
                    setActiveTab('future')
                    // Select first future lesson when switching to future tab
                    const now = new Date()
                    const futureLessons = lessons.filter(lesson => new Date(lesson.dateTime) >= now)
                    if (futureLessons.length > 0) {
                      const sorted = [...futureLessons].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
                      const lessonWithHomework = { ...sorted[0], homework: parseHomeworkFromNotes(sorted[0].notes) }
                      setSelectedLesson(lessonWithHomework)
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'future'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Future ({futureCount})
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredLessons.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No {activeTab === 'future' ? 'future' : 'past'} lessons found
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredLessons.map((lesson) => {
                    const isSelected = selectedLesson?.id === lesson.id
                    return (
                      <li
                        key={lesson.id}
                        onClick={() => {
                          const lessonWithHomework = { ...lesson, homework: parseHomeworkFromNotes(lesson.notes) }
                          setSelectedLesson(lessonWithHomework)
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 border-l-4 border-indigo-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <CalendarIcon className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {formatDate(lesson.dateTime)}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {formatTime(lesson.dateTime)}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-700 mt-1">
                                {lesson.subject}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(lesson.duration)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${parseFloat(lesson.price).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: Lesson Details */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow flex flex-col" style={{ minHeight: '600px' }}>
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Lesson Details</h2>
              </div>
            </div>
            <div className="p-8 flex-1 overflow-y-auto">
              {selectedLesson ? (
                <div className="space-y-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Date & Time</span>
                      </div>
                      <p className="text-gray-900 text-base">{formatDateTime(selectedLesson.dateTime)}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <BookOpen className="h-4 w-4" />
                        <span>Subject</span>
                      </div>
                      <p className="text-gray-900 font-medium text-base">{selectedLesson.subject}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <Clock className="h-4 w-4" />
                          <span>Duration</span>
                        </div>
                        <p className="text-gray-900 text-base">{formatDuration(selectedLesson.duration)}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <DollarSign className="h-4 w-4" />
                          <span>Price</span>
                        </div>
                        <p className="text-gray-900 text-base">${parseFloat(selectedLesson.price).toFixed(2)}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        {selectedLesson.locationType === 'remote' ? (
                          <Video className="h-4 w-4" />
                        ) : (
                          <MapPin className="h-4 w-4" />
                        )}
                        <span>Location</span>
                      </div>
                      <p className="text-gray-900 text-base">
                        {selectedLesson.locationType === 'remote' ? 'Video Call' : 'In Person'}
                      </p>
                      {selectedLesson.locationType === 'remote' && selectedLesson.link && (
                        <a
                          href={selectedLesson.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 text-sm mt-2 block"
                        >
                          {selectedLesson.link}
                        </a>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <span>Payment Status</span>
                      </div>
                      <p className={`font-medium text-base ${
                        selectedLesson.isPaid 
                          ? 'text-green-600' 
                          : selectedLesson.paidAmount > 0 
                            ? 'text-yellow-600' 
                            : 'text-red-600'
                      }`}>
                        {selectedLesson.isPaid 
                          ? 'Paid' 
                          : selectedLesson.paidAmount > 0 
                            ? `Partially Paid ($${parseFloat(selectedLesson.paidAmount).toFixed(2)})` 
                            : 'Unpaid'}
                      </p>
                    </div>
                  </div>

                  {/* Academic Notes */}
                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <FileText className="h-4 w-4" />
                        <span>Academic Notes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer transition-colors">
                          <Upload className="h-3 w-3" />
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'notes')}
                          />
                          Attach Files
                        </label>
                        <button
                          onClick={handleSaveNotes}
                          disabled={!notesChanged || savingNotes}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Save className="h-3 w-3" />
                          {savingNotes ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <textarea
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        rows={6}
                        className="w-full text-base border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 resize-none"
                        placeholder="Enter academic notes... You can include links, text, etc."
                      />
                      {notesFiles.length > 0 && (
                        <div className="space-y-2">
                          {notesFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                              <Paperclip className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                              <button
                                onClick={() => removeFile(index, 'notes')}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Display stored files */}
                      {selectedLesson.notesFiles && (() => {
                        try {
                          const files = JSON.parse(selectedLesson.notesFiles)
                          if (files && files.length > 0) {
                            return (
                              <div className="space-y-2">
                                <div className="text-xs text-gray-500 font-medium">Attached Files:</div>
                                {files.map((file, index) => (
                                  <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-md border border-gray-200">
                                    <Paperclip className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-700 flex-1 truncate">{file.fileName}</span>
                                    <div className="flex items-center gap-2">
                                      {file.storageType === 'googleDrive' && file.webViewLink ? (
                                        <a
                                          href={file.webViewLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-600 hover:text-indigo-900 text-xs"
                                        >
                                          View
                                        </a>
                                      ) : file.filePath ? (
                                        <a
                                          href={file.filePath}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-600 hover:text-indigo-900 text-xs"
                                        >
                                          View
                                        </a>
                                      ) : null}
                                      <button
                                        onClick={() => handleDeleteStoredFile('notes', index)}
                                        className="text-red-600 hover:text-red-800 text-xs"
                                        title="Delete file"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        } catch (e) {
                          return null
                        }
                        return null
                      })()}
                      <div className="text-xs text-gray-500">
                        Tip: You can paste links directly in the text. They will be clickable when saved.
                      </div>
                    </div>
                  </div>

                  {/* Homework */}
                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <BookOpen className="h-4 w-4" />
                        <span>Homework</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer transition-colors">
                          <Upload className="h-3 w-3" />
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'homework')}
                          />
                          Attach Files
                        </label>
                        <button
                          onClick={handleSaveHomework}
                          disabled={!homeworkChanged || savingHomework}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Save className="h-3 w-3" />
                          {savingHomework ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <textarea
                        value={editedHomework}
                        onChange={(e) => setEditedHomework(e.target.value)}
                        rows={6}
                        className="w-full text-base border-gray-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 resize-none"
                        placeholder="Enter homework assignment... You can include links, text, etc."
                      />
                      {homeworkFiles.length > 0 && (
                        <div className="space-y-2">
                          {homeworkFiles.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                              <Paperclip className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                              <button
                                onClick={() => removeFile(index, 'homework')}
                                className="text-red-600 hover:text-red-800"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Display stored homework files */}
                      {selectedLesson.homeworkFiles && (() => {
                        try {
                          const files = JSON.parse(selectedLesson.homeworkFiles)
                          if (files && files.length > 0) {
                            return (
                              <div className="space-y-2">
                                <div className="text-xs text-gray-500 font-medium">Attached Files:</div>
                                {files.map((file, index) => (
                                  <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-md border border-gray-200">
                                    <Paperclip className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-700 flex-1 truncate">{file.fileName}</span>
                                    <div className="flex items-center gap-2">
                                      {file.storageType === 'googleDrive' && file.webViewLink ? (
                                        <a
                                          href={file.webViewLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-600 hover:text-indigo-900 text-xs"
                                        >
                                          View
                                        </a>
                                      ) : file.filePath ? (
                                        <a
                                          href={file.filePath}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-600 hover:text-indigo-900 text-xs"
                                        >
                                          View
                                        </a>
                                      ) : null}
                                      <button
                                        onClick={() => handleDeleteStoredFile('homework', index)}
                                        className="text-red-600 hover:text-red-800 text-xs"
                                        title="Delete file"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        } catch (e) {
                          return null
                        }
                        return null
                      })()}
                      <div className="text-xs text-gray-500">
                        Tip: You can paste links directly in the text. They will be clickable when saved.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm">Select a lesson to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

