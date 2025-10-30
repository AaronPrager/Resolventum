import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Edit, Trash2, Phone, Mail, MapPin, User, Calendar, DollarSign, BookOpen, AlertCircle, Users as UsersIcon, X } from 'lucide-react'
import toast from 'react-hot-toast'

export function Students() {
  const [students, setStudents] = useState([])
  const [sortedStudents, setSortedStudents] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' })
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
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
    notes: ''
  })

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students')
      setStudents(data)
      setSortedStudents(sortStudentData(data, sortConfig.key, sortConfig.direction))
    } catch (error) {
      toast.error('Failed to load students')
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
      return <span className="ml-1 text-gray-400">⇅</span>
    }
    return sortConfig.direction === 'asc' ? 
      <span className="ml-1">↑</span> : 
      <span className="ml-1">↓</span>
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
        notes: formData.notes || null
      }

      if (isEditing && selectedStudent) {
        await api.put(`/students/${selectedStudent.id}`, submitData)
        toast.success('Student updated successfully')
      } else {
        await api.post('/students', submitData)
        toast.success('Student created successfully')
      }

      fetchStudents()
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
      notes: selectedStudent.notes || ''
    })
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
      notes: ''
    })
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students List - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Students</h2>
              <p className="text-sm text-gray-500 mt-1">{students.length} {students.length === 1 ? 'student' : 'students'}</p>
            </div>
            <button
              onClick={handleAddStudent}
              className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Add new student"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          
          {/* Sortable Column Headers */}
          {students.length > 0 && (
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
            {students.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No students added yet
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {sortedStudents.map((student) => {
                  const isSelected = selectedStudent?.id === student.id
                  
                  return (
                    <li
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-indigo-50 border-l-4 border-indigo-600 pl-4 pr-4 py-3' 
                          : 'hover:bg-gray-50 p-4 pl-[17px]'
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
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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
                                <div className="font-medium">${parseFloat(student.pricePerLesson).toFixed(2)}/lesson</div>
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
                          ? `$${parseFloat(selectedStudent.pricePerLesson).toFixed(2)} per lesson`
                          : 'Per lesson: -'}
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

                    {/* Price Per Lesson */}
                    <div className="flex items-center py-2">
                      <label className="w-32 text-sm text-gray-600">Price/Lesson</label>
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
    </div>
  )
}
