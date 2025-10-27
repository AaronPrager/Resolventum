import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Plus, Calendar, Clock, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

export function Lessons() {
  const [lessons, setLessons] = useState([])
  const [students, setStudents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    studentId: '',
    dateTime: '',
    duration: 60,
    subject: '',
    price: 0,
    notes: '',
    status: 'scheduled'
  })

  useEffect(() => {
    fetchLessons()
    fetchStudents()
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Convert datetime-local value to ISO string
      const submitData = {
        ...formData,
        dateTime: new Date(formData.dateTime).toISOString(),
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration)
      }
      
      await api.post('/lessons', submitData)
      toast.success('Lesson scheduled successfully')
      fetchLessons()
      setShowModal(false)
      resetForm()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to schedule lesson')
    }
  }

  const resetForm = () => {
    setFormData({
      studentId: '',
      dateTime: '',
      duration: 60,
      subject: '',
      price: 0,
      notes: '',
      status: 'scheduled'
    })
  }

  const getStatusColor = (status) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rescheduled: 'bg-yellow-100 text-yellow-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Lessons</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Schedule Lesson
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {lesson.student.firstName} {lesson.student.lastName}
                      </p>
                      <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lesson.status)}`}>
                        {lesson.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <Calendar className="flex-shrink-0 mr-1.5 h-5 w-5" />
                      {new Date(lesson.dateTime).toLocaleString()}
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <Clock className="flex-shrink-0 mr-1.5 h-5 w-5" />
                      {lesson.duration} minutes - {lesson.subject}
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <DollarSign className="flex-shrink-0 mr-1.5 h-5 w-5" />
                      ${lesson.price}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => { setShowModal(false); resetForm(); }}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Schedule New Lesson
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Student</label>
                      <select
                        required
                        value={formData.studentId}
                        onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="">Select student</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.firstName} {s.lastName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.dateTime}
                        onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                        <input
                          type="number"
                          min="15"
                          step="15"
                          required
                          value={formData.duration}
                          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Price ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Subject</label>
                      <input
                        type="text"
                        required
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

