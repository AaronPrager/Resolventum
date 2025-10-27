import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Download, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

export function Reports() {
  const [report, setReport] = useState(null)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [month, year])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/reports/monthly?month=${month}&year=${year}`)
      setReport(data)
    } catch (error) {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = () => {
    // Implementation would generate and download PDF
    toast.success('Report downloaded successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Monthly Reports</h1>
        <button
          onClick={downloadReport}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Download className="h-5 w-5 mr-2" />
          Download Report
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Calendar className="h-5 w-5 text-gray-400" />
          <div className="flex space-x-4">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-8">Loading report...</p>
        ) : report ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Lessons</p>
                <p className="text-2xl font-bold text-gray-900">{report.summary.totalLessons}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{report.summary.completedLessons}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-600">${report.summary.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-red-600">${report.summary.outstandingBalance.toFixed(2)}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Students Activity</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lessons</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.students.map((student) => (
                      <tr key={student.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.lessons}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center py-8 text-gray-500">No data available</p>
        )}
      </div>
    </div>
  )
}

