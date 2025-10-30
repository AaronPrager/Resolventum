import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Edit, Trash2, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export function Students() {
  const [students, setStudents] = useState([])
  const [sortedStudents, setSortedStudents] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
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
      setSortedStudents(data)
    } catch (error) {
      toast.error('Failed to load students')
    }
  }

  const sortData = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }

    const sorted = [...students].sort((a, b) => {
      let aValue = a[key]
      let bValue = b[key]

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
      
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, submitData)
        toast.success('Student updated successfully')
      } else {
        await api.post('/students', submitData)
        toast.success('Student created successfully')
      }
      await fetchStudents()
      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error('Save student error:', error.response?.data)
      if (error.response?.data?.errors) {
        // Show validation errors
        error.response.data.errors.forEach(err => {
          toast.error(`${err.path}: ${err.msg}`)
        })
      } else {
        toast.error(error.response?.data?.message || 'Failed to save student')
      }
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this student?')) return
    try {
      await api.delete(`/students/${id}`)
      toast.success('Student deleted successfully')
      await fetchStudents()
    } catch (error) {
      toast.error('Failed to delete student')
    }
  }

  const handleEdit = (student) => {
    setEditingStudent(student)
    setFormData({
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
      email: student.email || '',
      phone: student.phone || '',
      address: student.address || '',
      schoolName: student.schoolName || '',
      grade: student.grade || '',
      subject: student.subject || '',
      difficulties: student.difficulties || '',
      pricePerLesson: student.pricePerLesson || '',
      pricePerPackage: student.pricePerPackage || '',
      parentFullName: student.parentFullName || '',
      parentAddress: student.parentAddress || '',
      parentPhone: student.parentPhone || '',
      parentEmail: student.parentEmail || '',
      emergencyContactInfo: student.emergencyContactInfo || '',
      notes: student.notes || ''
    })
    setShowModal(true)
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
    setEditingStudent(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Students</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Student
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sortData('firstName')}
                >
                  <div className="flex items-center">
                    First Name
                    <SortIcon column="firstName" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sortData('lastName')}
                >
                  <div className="flex items-center">
                    Last Name
                    <SortIcon column="lastName" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Phone
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sortData('grade')}
                >
                  <div className="flex items-center">
                    Grade
                    <SortIcon column="grade" />
                  </div>
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
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => sortData('pricePerLesson')}
                >
                  <div className="flex items-center">
                    Price
                    <SortIcon column="pricePerLesson" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedStudents.map((student) => (
                <tr 
                  key={student.id} 
                  onClick={() => handleEdit(student)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {student.firstName}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {student.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {student.phone || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    {student.grade ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {student.grade}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{student.subject || '-'}</div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {student.pricePerLesson && (
                        <div className="font-medium">${parseFloat(student.pricePerLesson).toFixed(2)}/lesson</div>
                      )}
                      {student.pricePerPackage && (
                        <div className={student.pricePerLesson ? 'text-xs text-gray-500 mt-0.5' : 'font-medium'}>
                          ${parseFloat(student.pricePerPackage).toFixed(2)}/pkg
                        </div>
                      )}
                      {!student.pricePerLesson && !student.pricePerPackage && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit}>
                <div className="bg-white">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingStudent ? 'Edit Student' : 'New Student'}
                    </h3>
                  </div>
                  
                  <div className="px-6 py-4 space-y-1">
                    {/* First Name & Last Name */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Name</label>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          required
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="First name"
                        />
                        <input
                          type="text"
                          required
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="flex-1 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="Last name"
                        />
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Date of Birth</label>
                      <div className="flex-1">
                        <input
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    {/* Phone & Email */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Contact</label>
                      <div className="flex-1 space-y-2">
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="Phone number"
                        />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="Email (optional)"
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Address</label>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="Street address"
                        />
                      </div>
                    </div>

                    {/* School Name */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">School</label>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={formData.schoolName}
                          onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="School name"
                        />
                      </div>
                    </div>

                    {/* Grade */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Grade</label>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={formData.grade}
                          onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="e.g., 8th Grade"
                        />
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Subject</label>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="e.g., Math, Physics"
                        />
                      </div>
                    </div>

                    {/* Price Per Lesson */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Price/Lesson</label>
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-sm text-gray-600">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.pricePerLesson}
                          onChange={(e) => setFormData({ ...formData, pricePerLesson: e.target.value })}
                          className="w-24 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Price Per Package */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Price/Package</label>
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-sm text-gray-600">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.pricePerPackage}
                          onChange={(e) => setFormData({ ...formData, pricePerPackage: e.target.value })}
                          className="w-24 border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="0.00"
                        />
                        <span className="text-xs text-gray-500">(10 lessons)</span>
                      </div>
                    </div>

                    {/* Difficulties */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Difficulties</label>
                      <div className="flex-1">
                        <textarea
                          value={formData.difficulties}
                          onChange={(e) => setFormData({ ...formData, difficulties: e.target.value })}
                          rows={2}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm resize-none"
                          placeholder="Learning challenges or areas needing focus"
                        />
                      </div>
                    </div>

                    {/* Parent Name */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Parent Name</label>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={formData.parentFullName}
                          onChange={(e) => setFormData({ ...formData, parentFullName: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="Full name"
                        />
                      </div>
                    </div>

                    {/* Parent Contact */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Parent Contact</label>
                      <div className="flex-1 space-y-2">
                        <input
                          type="tel"
                          value={formData.parentPhone}
                          onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="Phone number"
                        />
                        <input
                          type="email"
                          value={formData.parentEmail}
                          onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="Email address"
                        />
                      </div>
                    </div>

                    {/* Parent Address */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Parent Address</label>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={formData.parentAddress}
                          onChange={(e) => setFormData({ ...formData, parentAddress: e.target.value })}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm"
                          placeholder="If different from student"
                        />
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="flex items-start py-2">
                      <label className="w-32 text-sm text-gray-600 pt-2">Emergency</label>
                      <div className="flex-1">
                        <textarea
                          value={formData.emergencyContactInfo}
                          onChange={(e) => setFormData({ ...formData, emergencyContactInfo: e.target.value })}
                          rows={2}
                          className="w-full border-0 border-b border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-1.5 text-sm resize-none"
                          placeholder="Name, phone, relationship (if different from parent)"
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
                          placeholder="Additional information..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse sm:justify-between">
                  <div className="flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      {editingStudent ? 'Update' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                  {editingStudent && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to delete this student?')) {
                          try {
                            await api.delete(`/students/${editingStudent.id}`)
                            toast.success('Student deleted successfully')
                            await fetchStudents()
                            setShowModal(false)
                            resetForm()
                          } catch (error) {
                            toast.error('Failed to delete student')
                          }
                        }
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Delete Student
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

