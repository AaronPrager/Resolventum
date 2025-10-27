import { useState } from 'react'
import { Calendar as CalendarComponent } from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { Clock, User } from 'lucide-react'

export function Calendar() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  // This would normally fetch lessons for selected date
  const lessons = []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CalendarComponent
            onChange={setSelectedDate}
            value={selectedDate}
            className="bg-white rounded-lg shadow p-4"
          />
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Lessons for {selectedDate.toLocaleDateString()}
          </h3>
          {lessons.length > 0 ? (
            <ul className="space-y-3">
              {lessons.map((lesson) => (
                <li key={lesson.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-indigo-600 mr-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {lesson.subject}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <User className="h-3 w-3 mr-1" />
                        {lesson.student.firstName} {lesson.student.lastName}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-8">No lessons scheduled</p>
          )}
        </div>
      </div>
    </div>
  )
}

