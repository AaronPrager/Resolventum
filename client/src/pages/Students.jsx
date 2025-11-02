import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Edit, Trash2, Phone, Mail, MapPin, User, Calendar, DollarSign, BookOpen, AlertCircle, Users as UsersIcon, X, ChevronUp, ChevronDown, FileText, Download, Archive, ArchiveRestore } from 'lucide-react'
import toast from 'react-hot-toast'

export function Students() {
  const [students, setStudents] = useState([])
  const [sortedStudents, setSortedStudents] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [activeTab, setActiveTab] = useState('current') // 'current' or 'archived'
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    address: '',
    schoolName: '',
    grade: '',
    subject: '',
    difficulties: '',
    pricePerLesson: '',
    pricePerPackage: '',
    parentFullName: '',
    parentAddress: '',
    parentPhone: '',
    parentEmail: '',
    emergencyContactInfo: '',
    notes: '',
    familyId: ''
  })
  const [families, setFamilies] = useState([])
  const [newFamilyId, setNewFamilyId] = useState('')
  const [useNewFamily, setUseNewFamily] = useState(false)

  useEffect(() => {
    fetchStudents()
    fetchFamilies()
  }, [activeTab])

  const fetchFamilies = async () => {
    try {
      const { data } = await api.get('/students/families')
      setFamilies(data)
    } catch (error) {
      // Ignore errors, families are optional
    }
  }

  const fetchStudents = async () => {
    try {
      // Always fetch all students (including archived) so we can show accurate counts
      const { data } = await api.get('/students?includeArchived=true')
      setStudents(data)
      // Sorted students will be calculated based on active tab
    } catch (error) {
      toast.error('Failed to load students')
    }
  }

  const handleArchive = async (studentId, archived) => {
    try {
      await api.patch(`/students/${studentId}/archive`, { archived })
      toast.success(archived ? 'Student archived' : 'Student unarchived')
      fetchStudents()
      // If we archived the selected student, clear selection
      if (selectedStudent?.id === studentId && archived) {
        setSelectedStudent(null)
      }
    } catch (error) {
      toast.error('Failed to update student')
    }
  }

  const sortStudentData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      let aValue = a[key]
      let bValue = b[key]

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = ''
      if (bValue === null || bValue === undefined) bValue = ''

      // For name sorting, combine first and last name
      if (key === 'name') {
        aValue = `${a.firstName} ${a.lastName}`.toLowerCase()
        bValue = `${b.firstName} ${b.lastName}`.toLowerCase()
      } else if (typeof aValue === 'string') {
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

    const sorted = sortStudentData(students, key, direction)
    setSortedStudents(sorted)
    setSortConfig({ key, direction })
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
    try {
      // Convert empty strings to null for optional fields
      const submitData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString() : null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        schoolName: formData.schoolName || null,
        grade: formData.grade || null,
        subject: formData.subject || null,
        difficulties: formData.difficulties || null,
        pricePerLesson: formData.pricePerLesson ? parseFloat(formData.pricePerLesson) : null,
        pricePerPackage: formData.pricePerPackage ? parseFloat(formData.pricePerPackage) : null,
        parentFullName: formData.parentFullName || null,
        parentAddress: formData.parentAddress || null,
        parentPhone: formData.parentPhone || null,
        parentEmail: formData.parentEmail || null,
        emergencyContactInfo: formData.emergencyContactInfo || null,
        notes: formData.notes || null,
        familyId: useNewFamily && newFamilyId ? newFamilyId : (formData.familyId || null)
      }

      if (isEditing && selectedStudent) {
        await api.put(`/students/${selectedStudent.id}`, submitData)
        toast.success('Student updated successfully')
      } else {
        await api.post('/students', submitData)
        toast.success('Student created successfully')
      }

      fetchStudents()
      fetchFamilies()
      setShowModal(false)
      setIsEditing(false)
      resetForm()
    } catch (error) {
      toast.error(isEditing ? 'Failed to update student' : 'Failed to create student')
    }
  }

  const handleAddStudent = () => {
    resetForm()
    setIsEditing(false)
    setSelectedStudent(null)
    setShowModal(true)
  }

  const handleEditStudent = () => {
    if (!selectedStudent) return
    
    setFormData({
      firstName: selectedStudent.firstName,
      lastName: selectedStudent.lastName,
      dateOfBirth: selectedStudent.dateOfBirth ? new Date(selectedStudent.dateOfBirth).toISOString().split('T')[0] : '',
      email: selectedStudent.email || '',
      phone: selectedStudent.phone || '',
      address: selectedStudent.address || '',
      schoolName: selectedStudent.schoolName || '',
      grade: selectedStudent.grade || '',
      subject: selectedStudent.subject || '',
      difficulties: selectedStudent.difficulties || '',
      pricePerLesson: selectedStudent.pricePerLesson || '',
      pricePerPackage: selectedStudent.pricePerPackage || '',
      parentFullName: selectedStudent.parentFullName || '',
      parentAddress: selectedStudent.parentAddress || '',
      parentPhone: selectedStudent.parentPhone || '',
      parentEmail: selectedStudent.parentEmail || '',
      emergencyContactInfo: selectedStudent.emergencyContactInfo || '',
      notes: selectedStudent.notes || '',
      familyId: selectedStudent.familyId || ''
    })
    setUseNewFamily(false)
    setNewFamilyId('')
    setIsEditing(true)
    setShowModal(true)
  }

  const handleDeleteStudent = async () => {
    if (!selectedStudent || !window.confirm('Are you sure you want to delete this student?')) {
      return
    }

    try {
      await api.delete(`/students/${selectedStudent.id}`)
      toast.success('Student deleted successfully')
      setSelectedStudent(null)
      fetchStudents()
    } catch (error) {
      toast.error('Failed to delete student')
    }
  }

  const handleImportFromJson = async () => {
    try {
      // Parse JSON input
      const jsonData = JSON.parse(jsonInput)
      
      // Map JSON fields to student creation format
      // This handles variations in field names
      const studentData = {
        firstName: jsonData.firstName || jsonData.first_name || jsonData.name?.split(' ')[0] || '',
        lastName: jsonData.lastName || jsonData.last_name || jsonData.name?.split(' ').slice(1).join(' ') || '',
        dateOfBirth: jsonData.dateOfBirth || jsonData.date_of_birth || jsonData.dob || null,
        email: jsonData.email || null,
        phone: jsonData.phone || jsonData.phoneNumber || null,
        address: jsonData.address || null,
        schoolName: jsonData.schoolName || jsonData.school_name || jsonData.school || null,
        grade: jsonData.grade || null,
        subject: jsonData.subject || null,
        difficulties: jsonData.difficulties || jsonData.learningDifficulties || null,
        pricePerLesson: jsonData.pricePerLesson || jsonData.price_per_lesson || jsonData.pricePerLesson || null,
        pricePerPackage: jsonData.pricePerPackage || jsonData.price_per_package || jsonData.pricePerPackage || null,
        parentFullName: jsonData.parentFullName || jsonData.parent_full_name || jsonData.parentName || null,
        parentAddress: jsonData.parentAddress || jsonData.parent_address || null,
        parentPhone: jsonData.parentPhone || jsonData.parent_phone || null,
        parentEmail: jsonData.parentEmail || jsonData.parent_email || null,
        emergencyContactInfo: jsonData.emergencyContactInfo || jsonData.emergency_contact || jsonData.emergencyContact || null,
        notes: jsonData.notes || jsonData.note || null
      }

      // Validate required fields
      if (!studentData.firstName || !studentData.lastName) {
        toast.error('JSON must include firstName and lastName (or name)')
        return
      }

      // Clean up the data - convert empty strings to null and handle dates
      const cleanedData = {
        ...studentData,
        dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth).toISOString() : null,
        pricePerLesson: studentData.pricePerLesson ? parseFloat(studentData.pricePerLesson) : null,
        pricePerPackage: studentData.pricePerPackage ? parseFloat(studentData.pricePerPackage) : null
      }

      // Create student
      await api.post('/students', cleanedData)
      toast.success('Student imported successfully')
      
      setShowImportModal(false)
      setJsonInput('')
      fetchStudents()
    } catch (error) {
      if (error.response) {
        toast.error(error.response.data?.message || 'Failed to import student')
      } else if (error instanceof SyntaxError) {
        toast.error('Invalid JSON format. Please check your JSON syntax.')
      } else {
        toast.error('Failed to import student')
      }
    }
  }

  const handleExportToJson = () => {
    if (!selectedStudent) {
      toast.error('Please select a student to export')
      return
    }

    try {
      // Create a clean JSON object with only the relevant student fields (exclude internal fields)
      const exportData = {
        firstName: selectedStudent.firstName,
        lastName: selectedStudent.lastName,
        dateOfBirth: selectedStudent.dateOfBirth || null,
        email: selectedStudent.email || null,
        phone: selectedStudent.phone || null,
        address: selectedStudent.address || null,
        schoolName: selectedStudent.schoolName || null,
        grade: selectedStudent.grade || null,
        subject: selectedStudent.subject || null,
        difficulties: selectedStudent.difficulties || null,
        pricePerLesson: selectedStudent.pricePerLesson || null,
        pricePerPackage: selectedStudent.pricePerPackage || null,
        parentFullName: selectedStudent.parentFullName || null,
        parentAddress: selectedStudent.parentAddress || null,
        parentPhone: selectedStudent.parentPhone || null,
        parentEmail: selectedStudent.parentEmail || null,
        emergencyContactInfo: selectedStudent.emergencyContactInfo || null,
        notes: selectedStudent.notes || null
      }

      // Convert to JSON string with proper formatting
      const jsonString = JSON.stringify(exportData, null, 2)
      
      // Create a blob and download
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedStudent.firstName}_${selectedStudent.lastName}_student_data.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('Student data exported successfully')
    } catch (error) {
      toast.error('Failed to export student data')
    }
  }

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      email: '',
      phone: '',
      address: '',
      schoolName: '',
      grade: '',
      subject: '',
      difficulties: '',
      pricePerLesson: '',
      pricePerPackage: '',
      parentFullName: '',
      parentAddress: '',
      parentPhone: '',
      parentEmail: '',
      emergencyContactInfo: '',
      notes: '',
      familyId: ''
    })
    setUseNewFamily(false)
    setNewFamilyId('')
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  // Filter students by archive status
  const currentStudents = students.filter(s => !s.archived)
  const archivedStudents = students.filter(s => s.archived)
  const displayedStudents = activeTab === 'current' ? currentStudents : archivedStudents
  const displayedSortedStudents = sortStudentData(displayedStudents, sortConfig.key, sortConfig.direction)

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students List - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          {/* Header with Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Students</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {activeTab === 'current' 
                    ? `${currentStudents.length} ${currentStudents.length === 1 ? 'student' : 'students'}`
                    : `${archivedStudents.length} ${archivedStudents.length === 1 ? 'archived student' : 'archived students'}`
                  }
                </p>
              </div>
              <div className="flex gap-2">
                {activeTab === 'current' && (
                  <>
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Import from JSON"
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleAddStudent}
                      className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Add new student"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex border-t border-gray-200">
              <button
                onClick={() => {
                  setActiveTab('current')
                  setSelectedStudent(null)
                }}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'current'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Current ({currentStudents.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('archived')
                  setSelectedStudent(null)
                }}
                className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'archived'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Archived ({archivedStudents.length})
              </button>
            </div>
          </div>
          
          {/* Sortable Column Headers */}
          {displayedStudents.length > 0 && (
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div 
                className="col-span-5 flex items-center cursor-pointer hover:text-gray-700"
                onClick={() => sortData('name')}
              >
                Name
                <SortIcon column="name" />
              </div>
              <div 
                className="col-span-2 flex items-center cursor-pointer hover:text-gray-700"
                onClick={() => sortData('grade')}
              >
                Grade
                <SortIcon column="grade" />
              </div>
              <div className="col-span-3">
                Subject
              </div>
              <div 
                className="col-span-2 flex items-center justify-end cursor-pointer hover:text-gray-700"
                onClick={() => sortData('pricePerLesson')}
              >
                Price
                <SortIcon column="pricePerLesson" />
              </div>
            </div>
          )}
          
          <div className="overflow-y-auto max-h-[590px]">
            {displayedStudents.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                {activeTab === 'current' ? 'No students added yet' : 'No archived students'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {displayedSortedStudents.map((student) => {
                  const isSelected = selectedStudent?.id === student.id
                  
                  return (
                    <li
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-indigo-100 border-l-4 border-indigo-700 pl-4 pr-4 py-3' 
                          : 'hover:bg-indigo-50 p-4 pl-[17px]'
                      }`}
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        {/* Name Column */}
                        <div className="col-span-5">
                          <p className="text-sm font-medium text-gray-900">
                            {student.firstName} {student.lastName}
                          </p>
                          {student.phone && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {student.phone}
                            </p>
                          )}
                        </div>
                        
                        {/* Grade Column */}
                        <div className="col-span-2">
                          {student.grade ? (
                            <span className="text-sm text-gray-900">
                              {student.grade}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                        
                        {/* Subject Column */}
                        <div className="col-span-3">
                          {student.subject ? (
                            <span className="text-sm text-gray-900 flex items-center gap-1">
                              <BookOpen className="h-3 w-3 text-gray-400" />
                              {student.subject}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                        
                        {/* Price Column */}
                        <div className="col-span-2 text-right">
                          {(student.pricePerLesson || student.pricePerPackage) ? (
                            <div className="text-xs text-gray-900">
                              {student.pricePerLesson && (
                                <div className="font-medium">${parseFloat(student.pricePerLesson).toFixed(2)}/hour</div>
                              )}
                              {student.pricePerPackage && (
                                <div className={student.pricePerLesson ? 'text-gray-500 mt-0.5' : 'font-medium'}>
                                  ${parseFloat(student.pricePerPackage).toFixed(2)}/pkg
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
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

        {/* Student Details Panel - Takes 1 column */}
        <div className="bg-white rounded-lg shadow" style={{ height: '708px' }}>
          {selectedStudent ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedStudent.subject || '-'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportToJson}
                      className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Export to JSON"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {selectedStudent.archived ? (
                      <button
                        onClick={() => handleArchive(selectedStudent.id, false)}
                        className="p-1.5 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                        title="Unarchive student"
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchive(selectedStudent.id, true)}
                        className="p-1.5 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                        title="Archive student"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={handleEditStudent}
                      className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit student"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleDeleteStudent}
                      className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete student"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2.5 overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
                {/* Student Info */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Information</h3>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">DOB:</span>
                    <span className={selectedStudent.dateOfBirth ? "text-gray-900" : "text-gray-400"}>
                      {selectedStudent.dateOfBirth ? formatDate(selectedStudent.dateOfBirth) : '-'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {selectedStudent.email ? (
                      <a href={`mailto:${selectedStudent.email}`} className="text-indigo-600 hover:text-indigo-900">
                        {selectedStudent.email}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {selectedStudent.phone ? (
                      <a href={`tel:${selectedStudent.phone}`} className="text-indigo-600 hover:text-indigo-900">
                        {selectedStudent.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span className={selectedStudent.address ? "text-gray-900" : "text-gray-400"}>
                      {selectedStudent.address || '-'}
                    </span>
                  </div>
                </div>

                {/* School Info */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">School</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">School:</span>
                    <span className={selectedStudent.schoolName ? "text-gray-900" : "text-gray-400"}>
                      {selectedStudent.schoolName || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Grade:</span>
                    <span className={selectedStudent.grade ? "text-gray-900" : "text-gray-400"}>
                      {selectedStudent.grade || '-'}
                    </span>
                  </div>
                </div>

                {/* Learning Info */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Learning Notes</h3>
                  <div className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span className={selectedStudent.difficulties ? "text-gray-900" : "text-gray-400"}>
                      {selectedStudent.difficulties || '-'}
                    </span>
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing</h3>
                  <div className="flex items-start gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className={selectedStudent.pricePerLesson ? "text-gray-900" : "text-gray-400"}>
                        {selectedStudent.pricePerLesson 
                          ? `$${parseFloat(selectedStudent.pricePerLesson).toFixed(2)} per hour`
                          : 'Per hour: -'}
                      </div>
                      <div className={selectedStudent.pricePerPackage ? "text-gray-900" : "text-gray-400"}>
                        {selectedStudent.pricePerPackage 
                          ? `$${parseFloat(selectedStudent.pricePerPackage).toFixed(2)} per package of 10`
                          : 'Per package: -'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parent Info */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Parent Information</h3>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className={selectedStudent.parentFullName ? "text-gray-900" : "text-gray-400"}>
                      {selectedStudent.parentFullName || '-'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {selectedStudent.parentEmail ? (
                      <a href={`mailto:${selectedStudent.parentEmail}`} className="text-indigo-600 hover:text-indigo-900">
                        {selectedStudent.parentEmail}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {selectedStudent.parentPhone ? (
                      <a href={`tel:${selectedStudent.parentPhone}`} className="text-indigo-600 hover:text-indigo-900">
                        {selectedStudent.parentPhone}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span className={selectedStudent.parentAddress ? "text-gray-900" : "text-gray-400"}>
                      {selectedStudent.parentAddress || '-'}
                    </span>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Emergency Contact</h3>
                  <div className="flex items-start gap-2 text-sm">
                    <UsersIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span className={selectedStudent.emergencyContactInfo ? "text-gray-900" : "text-gray-400"}>
                      {selectedStudent.emergencyContactInfo || '-'}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5 pt-2 border-t">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</h3>
                  <p className={`text-sm whitespace-pre-wrap ${selectedStudent.notes ? 'text-gray-900' : 'text-gray-400'}`}>
                    {selectedStudent.notes || '-'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full p-8 text-center text-gray-500 text-sm">
              Select a student to view details
            </div>
          )}
        </div>
      </div>

      {/* Modal for Add/Edit Student */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <div className="bg-white">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {isEditing ? 'Edit Student' : 'New Student'}
                    </h3>
                  </div>
                  
                  <div className="px-6 py-4 space-y-1">
                    {/* First Name & Last Name */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Name <span className="text-red-500">*</span></label>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          required
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          placeholder="First name"
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          required
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          placeholder="Last name"
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                        />
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Email */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="student@example.com"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Phone */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Address */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="123 Main St, City, State"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* School Name */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">School</label>
                      <input
                        type="text"
                        value={formData.schoolName}
                        onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                        placeholder="School name"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Grade */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Grade</label>
                      <input
                        type="text"
                        value={formData.grade}
                        onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                        placeholder="e.g., 10th, Junior"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Subject */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Subject</label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="e.g., Math, Physics"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Difficulties */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Difficulties</label>
                      <textarea
                        value={formData.difficulties}
                        onChange={(e) => setFormData({ ...formData, difficulties: e.target.value })}
                        placeholder="Learning challenges or areas of difficulty"
                        rows="2"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm resize-none"
                      />
                    </div>

                    {/* Price Per Hour */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Price/Hour</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricePerLesson}
                        onChange={(e) => setFormData({ ...formData, pricePerLesson: e.target.value })}
                        placeholder="0.00"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Price Per Package */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Price/Package</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pricePerPackage}
                        onChange={(e) => setFormData({ ...formData, pricePerPackage: e.target.value })}
                        placeholder="0.00"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Parent Full Name */}
                    <div className="flex items-center py-2 mt-4">
                      <label className="w-32 text-sm text-gray-600 font-medium">Parent Name</label>
                      <input
                        type="text"
                        value={formData.parentFullName}
                        onChange={(e) => setFormData({ ...formData, parentFullName: e.target.value })}
                        placeholder="Parent's full name"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Parent Phone */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Parent Phone</label>
                      <input
                        type="tel"
                        value={formData.parentPhone}
                        onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                        placeholder="(555) 123-4567"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Parent Email */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Parent Email</label>
                      <input
                        type="email"
                        value={formData.parentEmail}
                        onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                        placeholder="parent@example.com"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Parent Address */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Parent Address</label>
                      <input
                        type="text"
                        value={formData.parentAddress}
                        onChange={(e) => setFormData({ ...formData, parentAddress: e.target.value })}
                        placeholder="If different from student"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Emergency Contact */}
                    <div className="flex items-start py-2 mt-4">
                      <label className="w-32 text-sm text-gray-600 pt-2 font-medium">Emergency Contact</label>
                      <textarea
                        value={formData.emergencyContactInfo}
                        onChange={(e) => setFormData({ ...formData, emergencyContactInfo: e.target.value })}
                        placeholder="If different from parent"
                        rows="2"
                        className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm resize-none"
                      />
                    </div>

                    {/* Family */}
                    <div className="flex items-center py-2 mt-4">
                      <label className="w-32 text-sm text-gray-600">Family Group</label>
                      <div className="flex-1 space-y-2">
                        <select
                          value={useNewFamily ? 'new' : (formData.familyId || '')}
                          onChange={(e) => {
                            if (e.target.value === 'new') {
                              setUseNewFamily(true)
                              setFormData({ ...formData, familyId: '' })
                            } else if (e.target.value === '') {
                              setUseNewFamily(false)
                              setFormData({ ...formData, familyId: '' })
                            } else {
                              setUseNewFamily(false)
                              setFormData({ ...formData, familyId: e.target.value })
                            }
                          }}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                        >
                          <option value="">No Family (Individual)</option>
                          {families.map((family) => (
                            <option key={family.familyId} value={family.familyId}>
                              {family.members.map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                            </option>
                          ))}
                          <option value="new">Create New Family...</option>
                        </select>
                        {useNewFamily && (
                          <input
                            type="text"
                            value={newFamilyId}
                            onChange={(e) => setNewFamilyId(e.target.value)}
                            placeholder="Enter family ID (e.g., family name or unique identifier)"
                            className="w-full border-0 border-b border-gray-300 focus:border-indigo-600 focus:ring-0 px-2 py-1 text-sm"
                          />
                        )}
                        <p className="text-xs text-gray-500">
                          Students in the same family will have combined finances and reports
                        </p>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Notes</label>
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
                      {isEditing ? 'Save Changes' : 'Add Student'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import from JSON Modal */}
      {showImportModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Import Student from JSON
                  </h3>
                  <button
                    onClick={() => {
                      setShowImportModal(false)
                      setJsonInput('')
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="px-6 py-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste JSON data here:
                  </label>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{"firstName": "John", "lastName": "Doe", "email": "john@example.com", "phone": "555-1234", ...}'
                    rows="15"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Required fields: firstName, lastName. All other fields are optional.
                    <br />
                    Field name variations are supported (e.g., first_name, firstName, name).
                  </p>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false)
                      setJsonInput('')
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportFromJson}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                  >
                    Import Student
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
