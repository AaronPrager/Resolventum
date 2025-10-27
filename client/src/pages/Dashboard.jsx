import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Users, Clock, DollarSign, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

export function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    upcomingLessons: 0,
    monthlyRevenue: 0,
    activePackages: 0
  })
  const [recentLessons, setRecentLessons] = useState([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [studentsRes, lessonsRes, paymentsRes] = await Promise.all([
        api.get('/students'),
        api.get('/lessons?status=scheduled'),
        api.get('/payments')
      ])

      const students = studentsRes.data
      const upcomingLessons = lessonsRes.data.filter(
        lesson => new Date(lesson.dateTime) >= new Date()
      )

      setStats({
        totalStudents: students.length,
        upcomingLessons: upcomingLessons.length,
        monthlyRevenue: paymentsRes.data.reduce((sum, p) => sum + p.amount, 0),
        activePackages: students.reduce((sum, s) => sum + s.packages.length, 0)
      })

      setRecentLessons(upcomingLessons.slice(0, 5))
    } catch (error) {
      toast.error('Failed to load dashboard data')
    }
  }

  const StatCard = ({ icon: Icon, label, value }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className="h-6 w-6 text-gray-400" />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">{value}</div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Students" value={stats.totalStudents} />
        <StatCard icon={Clock} label="Upcoming Lessons" value={stats.upcomingLessons} />
        <StatCard icon={DollarSign} label="Monthly Revenue" value={`$${stats.monthlyRevenue}`} />
        <StatCard icon={Calendar} label="Active Packages" value={stats.activePackages} />
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Upcoming Lessons
          </h3>
          <div className="flow-root">
            <ul className="-my-5 divide-y divide-gray-200">
              {recentLessons.length > 0 ? recentLessons.map((lesson) => (
                <li key={lesson.id} className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {lesson.student.firstName} {lesson.student.lastName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {new Date(lesson.dateTime).toLocaleString()} - {lesson.subject}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {lesson.status}
                      </span>
                    </div>
                  </div>
                </li>
              )) : (
                <li className="py-4 text-center text-gray-500">
                  No upcoming lessons
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

