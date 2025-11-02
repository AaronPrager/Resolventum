import { useEffect, useState, useRef } from 'react'
import { api } from '../utils/api'
import { DollarSign, BookOpen, AlertCircle, Users as UsersIcon, Calendar as CalendarIcon, FileText, Download } from 'lucide-react'
import toast from 'react-hot-toast'

export function Reports() {
  const [summary, setSummary] = useState({
    totalIncome: 0,
    lessonsCompleted: 0,
    outstandingBalances: 0,
    totalStudents: 0,
  })
  const [outstanding, setOutstanding] = useState([])
  const [recentPayments, setRecentPayments] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState('outstanding') // 'outstanding'|'paymentHistory'|'monthlyTotals'|'schedule'|'attendance'|'cancellations'|'packages'
  const [packagesReport, setPackagesReport] = useState({ packages: [], summary: {} })
  const [packagesFilter, setPackagesFilter] = useState('all') // 'all', 'active', 'inactive'
  const [selectedPackageId, setSelectedPackageId] = useState(null)
  const [packageLessons, setPackageLessons] = useState([])
  const [scheduleRange, setScheduleRange] = useState('week') // 'week' | 'month'
  const [scheduleLessons, setScheduleLessons] = useState([])
  const [attendanceLessons, setAttendanceLessons] = useState([])
  const [studentStatement, setStudentStatement] = useState(null)
  const [stmtStudentId, setStmtStudentId] = useState('')
  const [stmtMonth, setStmtMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [stmtYear, setStmtYear] = useState(String(new Date().getFullYear()))
  const statementRef = useRef(null)

  // Student monthly report state
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [studentMonthly, setStudentMonthly] = useState({ lessons: [], payments: [] })
  const [loadingStudentMonthly, setLoadingStudentMonthly] = useState(false)

  const fetchData = async () => {
    try {
      const [summaryRes, outstandingRes, paymentsRes, allPaymentsRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/reports/outstanding'),
        api.get('/reports/payments/recent'),
        api.get('/payments'),
      ])

      setSummary({
        totalIncome: summaryRes.data?.totalIncome ?? 0,
        lessonsCompleted: summaryRes.data?.lessonsCompleted ?? 0,
        outstandingBalances: summaryRes.data?.outstandingBalances ?? 0,
        totalStudents: summaryRes.data?.totalStudents ?? 0,
      })
      setOutstanding(outstandingRes.data || [])
      setRecentPayments((paymentsRes.data || []).slice(0, 10))
      setAllPayments(allPaymentsRes.data || [])
    } catch (err) {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const fetchLessonsRange = async (start, end) => {
    try {
      const { data } = await api.get('/lessons', {
        params: { startDate: start.toISOString(), endDate: end.toISOString() }
      })
      return data
    } catch (e) {
      return []
    }
  }

  // Auto-generate student statement when filters change
  useEffect(() => {
    const load = async () => {
      if (!stmtStudentId) { setStudentStatement(null); return; }
      try {
        const res = await api.get('/reports/monthly-student', { params: { studentId: stmtStudentId, month: Number(stmtMonth), year: Number(stmtYear) } })
        setStudentStatement(res.data)
      } catch (e) {
        // leave previous or null
      }
    }
    load()
  }, [stmtStudentId, stmtMonth, stmtYear])

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/students')
      setStudents(data)
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    fetchData()
    fetchStudents()

    const interval = setInterval(fetchData, 60 * 1000)
    const onFocus = () => fetchData()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Auto-load packages report when packages report is active
  useEffect(() => {
    if (activeReport === 'packages') {
      const loadPackages = async () => {
        try {
          const { data } = await api.get('/reports/packages', { params: { status: packagesFilter } })
          console.log('Packages report data loaded:', data)
          if (data && data.packages) {
            setPackagesReport(data)
          } else {
            console.error('Invalid packages report data structure:', data)
            setPackagesReport({ packages: [], summary: {} })
          }
        } catch (error) {
          console.error('Failed to load packages report:', error)
          toast.error(error.response?.data?.message || 'Failed to load packages report')
        }
      }
      loadPackages()
    }
  }, [activeReport, packagesFilter])

  const formatCurrency = (amount) => {
    const num = Number(amount) || 0
    return `$${num.toFixed(2)}`
  }

  const handlePrintStatement = () => {
    if (!statementRef.current) return
    const content = statementRef.current.innerHTML
    const printWindow = window.open('', '', 'width=1024,height=768')
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html><head><title>Student Statement Preview</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; }
      h1,h2,h3 { margin: 0 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { font-size: 12px; border-bottom: 1px solid #e5e7eb; text-align: left; padding: 6px 8px; }
      .grid { display: grid; gap: 12px; }
      .toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
      .btn { padding: 6px 10px; font-size: 12px; border-radius: 6px; border: 1px solid #d1d5db; background: #f3f4f6; cursor: pointer; }
      @media print { .toolbar { display: none; } }
    </style></head><body>
      <div class="toolbar">
        <button class="btn" onclick="window.print()">Print</button>
      </div>
      ${content}
    </body></html>`)
    printWindow.document.close()
    printWindow.focus()
  }

  const loadStudentMonthly = async () => {
    if (!selectedStudentId) {
      toast.error('Select a student')
      return
    }
    try {
      setLoadingStudentMonthly(true)
      const res = await api.get('/reports/monthly', {
        params: { month: Number(month), year: Number(year), studentId: selectedStudentId },
      })
      const lessons = res.data?.lessons || []
      const payments = res.data?.payments || []
      setStudentMonthly({ lessons, payments })
    } catch (err) {
      toast.error('Failed to load student monthly report')
    } finally {
      setLoadingStudentMonthly(false)
    }
  }

  const totalBilledForStudent = studentMonthly.lessons
    .filter(l => l.status === 'completed')
    .reduce((sum, l) => sum + (l.price || 0), 0)
  const totalPaidForStudent = studentMonthly.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const balanceForStudent = totalBilledForStudent - totalPaidForStudent

  const handleGenerateInvoice = async () => {
    if (!selectedStudentId) return
    try {
      const response = await api.post(
        `/invoices/generate/${selectedStudentId}`,
        { month: Number(month), year: Number(year) },
        { responseType: 'blob' }
      )
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice-${month}-${year}.pdf`)
      document.body.appendChild(link)
      link.click()
      toast.success('Invoice generated')
    } catch (err) {
      toast.error('Failed to generate invoice')
    }
  }

  // Aggregation: totals per month with method breakdown
  const monthlyPaymentTotals = (() => {
    const map = new Map()
    for (const p of allPayments) {
      const d = new Date(p.date)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const prev = map.get(key) || { total: 0, venmo: 0, zelle: 0, cash: 0, other: 0 }
      const amount = Number(p.amount) || 0
      prev.total += amount
      const method = (p.method || 'other').toLowerCase()
      if (method === 'venmo' || method === 'zelle' || method === 'cash' || method === 'other') {
        prev[method] += amount
      } else {
        prev.other += amount
      }
      map.set(key, prev)
    }
    // Sort by month desc
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([monthKey, vals]) => ({ monthKey, ...vals }))
  })()

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Income (this month)</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(summary.totalIncome)}</p>
            </div>
            <div className="p-3 rounded-md bg-indigo-50 text-indigo-700">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Lessons Completed</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.lessonsCompleted}</p>
            </div>
            <div className="p-3 rounded-md bg-indigo-50 text-indigo-700">
              <BookOpen className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Outstanding Balances</p>
              <p className="mt-2 text-2xl font-semibold text-red-600">{formatCurrency(summary.outstandingBalances)}</p>
            </div>
            <div className="p-3 rounded-md bg-red-50 text-red-700">
              <AlertCircle className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.totalStudents}</p>
            </div>
            <div className="p-3 rounded-md bg-indigo-50 text-indigo-700">
              <UsersIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Reports Area: Left menu + Right content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Menu */}
        <div className="bg-white rounded-lg shadow p-3 h-fit">
          <p className="text-sm font-semibold text-gray-700 px-2 mb-2">Financial & Payment Reports</p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setActiveReport('outstanding')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'outstanding' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Outstanding Balances
              </button>
            </li>
            
            <li>
              <button
                onClick={() => setActiveReport('paymentHistory')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'paymentHistory' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Payment History
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveReport('monthlyTotals')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'monthlyTotals' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Monthly Payment Totals
              </button>
            </li>
            <li>
              <button
                onClick={async () => {
                  setActiveReport('packages')
                  try {
                    const { data } = await api.get('/reports/packages', { params: { status: packagesFilter } })
                    console.log('Packages report data:', data)
                    if (data && data.packages) {
                      setPackagesReport(data)
                    } else {
                      console.error('Invalid packages report data structure:', data)
                      setPackagesReport({ packages: [], summary: {} })
                      toast.error('Invalid packages report data received')
                    }
                  } catch (error) {
                    console.error('Failed to load packages report:', error)
                    toast.error(error.response?.data?.message || 'Failed to load packages report')
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'packages' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Package Tracking
              </button>
            </li>
          </ul>
          <p className="text-sm font-semibold text-gray-700 px-2 mt-4 mb-2">Scheduling & Attendance Reports</p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setActiveReport('schedule')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'schedule' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Lesson Schedule
              </button>
            </li>
            <li>
              <button
                onClick={async () => {
                  setActiveReport('attendance')
                  const now = new Date()
                  const start = new Date(now.getFullYear(), now.getMonth(), 1)
                  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
                  const data = await fetchLessonsRange(start, end)
                  setAttendanceLessons(data)
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'attendance' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Attendance Summary
              </button>
            </li>
            <li>
              <button
                onClick={async () => {
                  setActiveReport('cancellations')
                  const end = new Date()
                  const start = new Date()
                  start.setDate(end.getDate() - 90)
                  const data = await fetchLessonsRange(start, end)
                  setScheduleLessons(data)
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'cancellations' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Reschedule / Cancellation Log
              </button>
            </li>
          </ul>
          <p className="text-sm font-semibold text-gray-700 px-2 mt-4 mb-2">Student Statements</p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setActiveReport('studentStatement')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeReport === 'studentStatement' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                Monthly Student Statement
              </button>
            </li>
          </ul>
        </div>

        {/* Right Content (single active report) */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow overflow-hidden">
          {activeReport === 'outstanding' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Outstanding Balances Report</h2>
                <p className="text-sm text-gray-500">Shows which students owe money and how much.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lessons Completed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Billed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Payment Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {outstanding.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-6 text-center text-sm text-gray-500">No outstanding balances</td>
                      </tr>
                    ) : (
                      outstanding.map((row) => (
                        <tr key={row.studentId} className={Number(row.balanceDue) > 0 ? 'text-red-600' : ''}>
                          <td className="px-6 py-3 whitespace-nowrap text-gray-900">
                            {row.studentName}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">{row.lessonsCompleted ?? 0}</td>
                          <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.totalBilled)}</td>
                          <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.paid)}</td>
                          <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.balanceDue)}</td>
                          <td className="px-6 py-3 whitespace-nowrap">{row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === 'paymentHistory' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Payment History Report</h2>
                <p className="text-sm text-gray-500">Chronological list of all payments received.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allPayments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-6 text-center text-sm text-gray-500">No payments</td>
                      </tr>
                    ) : (
                      [...allPayments]
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map((p) => (
                          <tr key={p.id}>
                            <td className="px-6 py-3 whitespace-nowrap">{new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-gray-900">{p.student ? `${p.student.firstName} ${p.student.lastName}` : (p.studentName || '-')}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(p.amount)}</td>
                            <td className="px-6 py-3 whitespace-nowrap capitalize text-gray-700">{p.method}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-gray-700">{p.notes || '-'}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === 'monthlyTotals' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Monthly Payment Totals</h2>
                <p className="text-sm text-gray-500">Totals of all payments per month, broken down by method.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venmo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zelle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Other</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {monthlyPaymentTotals.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-6 text-center text-sm text-gray-500">No payments</td>
                      </tr>
                    ) : (
                      monthlyPaymentTotals.map(row => {
                        const [y, m] = row.monthKey.split('-')
                        const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
                        return (
                          <tr key={row.monthKey}>
                            <td className="px-6 py-3 whitespace-nowrap text-gray-900">{monthLabel}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.total)}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.venmo)}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.zelle)}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.cash)}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{formatCurrency(row.other)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {activeReport === 'schedule' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Lesson Schedule Report</h2>
                  <p className="text-sm text-gray-500">Upcoming {scheduleRange === 'week' ? 'week' : 'month'}’s scheduled lessons.</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <select
                    value={scheduleRange}
                    onChange={async (e) => {
                      const val = e.target.value
                      setScheduleRange(val)
                      const now = new Date()
                      let start = new Date()
                      let end = new Date()
                      if (val === 'week') {
                        const day = start.getDay()
                        const diff = start.getDate() - day + (day === 0 ? -6 : 1)
                        start = new Date(start.setDate(diff)); start.setHours(0,0,0,0)
                        end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
                      } else {
                        start = new Date(now.getFullYear(), now.getMonth(), 1)
                        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999)
                      }
                      const data = await fetchLessonsRange(start, end)
                      setScheduleLessons(data.filter(l => l.status === 'scheduled'))
                    }}
                    className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-0"
                  >
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                  <button
                    onClick={async () => {
                      const now = new Date()
                      let start = new Date()
                      let end = new Date()
                      if (scheduleRange === 'week') {
                        const day = start.getDay()
                        const diff = start.getDate() - day + (day === 0 ? -6 : 1)
                        start = new Date(start.setDate(diff)); start.setHours(0,0,0,0)
                        end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
                      } else {
                        start = new Date(now.getFullYear(), now.getMonth(), 1)
                        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999)
                      }
                      const data = await fetchLessonsRange(start, end)
                      setScheduleLessons(data.filter(l => l.status === 'scheduled'))
                    }}
                    className="px-3 py-1.5 rounded-md text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {scheduleLessons.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-6 text-center text-sm text-gray-500">No scheduled lessons</td>
                      </tr>
                    ) : (
                      scheduleLessons
                        .sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime))
                        .map(l => {
                          const start = new Date(l.dateTime)
                          const end = new Date(start.getTime() + (l.duration || 0) * 60000)
                          const time = l.allDay ? 'All Day' : `${start.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})} - ${end.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})}`
                          return (
                            <tr key={l.id}>
                              <td className="px-6 py-3 whitespace-nowrap">{start.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}</td>
                              <td className="px-6 py-3 whitespace-nowrap">{time}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-gray-900">{l.student ? `${l.student.firstName} ${l.student.lastName}` : '-'}</td>
                              <td className="px-6 py-3 whitespace-nowrap">{l.subject || '-'}</td>
                              <td className="px-6 py-3 whitespace-nowrap capitalize">{l.locationType || '-'}</td>
                            </tr>
                          )
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === 'attendance' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Attendance Summary</h2>
                <p className="text-sm text-gray-500">Tracks lessons: scheduled, completed, canceled, no-show (current month).</p>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto bg-white border rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Canceled</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No-Show</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendanceLessons.length === 0 ? (
                        <tr><td colSpan="5" className="px-6 py-6 text-center text-sm text-gray-500">No lessons this month</td></tr>
                      ) : (
                        Object.values(attendanceLessons.reduce((acc, l) => {
                          const key = l.studentId || 'unknown'
                          if (!acc[key]) acc[key] = { studentName: l.student ? `${l.student.firstName} ${l.student.lastName}` : '-', scheduled: 0, completed: 0, cancelled: 0, noShow: 0 }
                          const st = (l.status || 'scheduled').toLowerCase()
                          if (st === 'completed') acc[key].completed++
                          else if (st === 'cancelled' || st === 'canceled') acc[key].cancelled++
                          else if (st === 'no-show' || st === 'noshow') acc[key].noShow++
                          else acc[key].scheduled++
                          return acc
                        }, {})).map((row, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-3 whitespace-nowrap text-gray-900">{row.studentName}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{row.scheduled}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{row.completed}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{row.cancelled}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{row.noShow}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeReport === 'packages' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Package Tracking Report</h2>
                  <p className="text-sm text-gray-500">Track all packages, their utilization, and status.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Filter:</label>
                  <select
                    value={packagesFilter}
                    onChange={async (e) => {
                      const newFilter = e.target.value
                      setPackagesFilter(newFilter)
                      try {
                        const { data } = await api.get('/reports/packages', { params: { status: newFilter } })
                        console.log('Packages report data after filter change:', data)
                        if (data && data.packages) {
                          setPackagesReport(data)
                        } else {
                          console.error('Invalid packages report data structure:', data)
                          setPackagesReport({ packages: [], summary: {} })
                        }
                      } catch (error) {
                        console.error('Failed to load packages report:', error)
                        toast.error(error.response?.data?.message || 'Failed to load packages report')
                      }
                    }}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-0"
                  >
                    <option value="all">All Packages</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>
              </div>

              {/* Summary Cards */}
              {packagesReport.summary && Object.keys(packagesReport.summary).length > 0 && (
                <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Total Packages</p>
                      <p className="text-lg font-semibold text-gray-900">{packagesReport.summary.totalPackages || 0}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Active Packages</p>
                      <p className="text-lg font-semibold text-green-700">{packagesReport.summary.activePackages || 0}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Total Revenue</p>
                      <p className="text-lg font-semibold text-gray-900">${(packagesReport.summary.totalPackageRevenue || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Avg Utilization</p>
                      <p className="text-lg font-semibold text-gray-900">{(packagesReport.summary.averageUtilization || 0).toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Hours Purchased</p>
                      <p className="text-lg font-semibold text-gray-900">{(packagesReport.summary.totalHoursPurchased || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Hours Used</p>
                      <p className="text-lg font-semibold text-indigo-700">{(packagesReport.summary.totalHoursUsed || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <p className="text-xs text-gray-500">Hours Remaining</p>
                      <p className="text-lg font-semibold text-green-700">{(packagesReport.summary.totalHoursRemaining || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Packages Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price / Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchased</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lessons</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {packagesReport.packages.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">No packages found</td>
                      </tr>
                    ) : (
                      packagesReport.packages.map((pkg) => {
                        const statusColors = {
                          'Active': 'bg-green-100 text-green-800',
                          'Used Up': 'bg-yellow-100 text-yellow-800',
                          'Expired': 'bg-red-100 text-red-800',
                          'Inactive': 'bg-gray-100 text-gray-800'
                        }
                        return (
                          <>
                            <tr key={pkg.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{pkg.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {pkg.student.firstName} {pkg.student.lastName}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[pkg.status] || 'bg-gray-100 text-gray-800'}`}>
                                  {pkg.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  <span className="font-medium">{pkg.hoursRemaining.toFixed(2)}</span>
                                  <span className="text-gray-500"> / {pkg.totalHours.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-gray-500">Used: {pkg.hoursUsed.toFixed(2)}h</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2" style={{ minWidth: '60px' }}>
                                    <div 
                                      className={`h-2 rounded-full ${
                                        pkg.utilizationPercent >= 100 ? 'bg-yellow-600' :
                                        pkg.utilizationPercent >= 75 ? 'bg-orange-500' :
                                        'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(pkg.utilizationPercent, 100)}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-900">{pkg.utilizationPercent.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">${pkg.price.toFixed(2)}</div>
                                <div className="text-xs text-gray-500">${pkg.packageHourlyRate.toFixed(2)}/hr</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(pkg.purchasedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {pkg.expiresAt 
                                  ? new Date(pkg.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                  : 'No expiry'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  onClick={async () => {
                                    if (selectedPackageId === pkg.id) {
                                      setSelectedPackageId(null)
                                      setPackageLessons([])
                                    } else {
                                      setSelectedPackageId(pkg.id)
                                      try {
                                        const { data } = await api.get(`/packages/${pkg.id}/usage`)
                                        setPackageLessons(data.usage || [])
                                      } catch (error) {
                                        console.error('Failed to load package lessons:', error)
                                        toast.error('Failed to load package lessons')
                                      }
                                    }
                                  }}
                                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  {selectedPackageId === pkg.id ? 'Hide' : 'View'} Lessons
                                </button>
                              </td>
                            </tr>
                            {selectedPackageId === pkg.id && (
                              <tr>
                                <td colSpan="9" className="px-6 py-4 bg-gray-50">
                                  <div className="mt-2">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Lessons Covered by This Package</h4>
                                    {packageLessons.length === 0 ? (
                                      <p className="text-sm text-gray-500">No lessons have been covered by this package yet.</p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                          <thead className="bg-white">
                                            <tr>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-gray-200">
                                            {packageLessons.map((lesson) => (
                                              <tr key={lesson.lessonId}>
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  {new Date(lesson.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900">{lesson.subject}</td>
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  {lesson.hours.toFixed(2)}h ({lesson.duration} min)
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  ${lesson.price.toFixed(2)}
                                                  <span className="text-xs text-gray-500 ml-1">
                                                    (${lesson.pricePerHour.toFixed(2)}/hr)
                                                  </span>
                                                </td>
                                                <td className="px-4 py-2 text-sm">
                                                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    lesson.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    lesson.status === 'cancelled' || lesson.status === 'canceled' ? 'bg-gray-100 text-gray-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                  }`}>
                                                    {lesson.status}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  {lesson.isPaid ? (
                                                    <span className="text-green-600 font-medium">${lesson.paidAmount.toFixed(2)} Paid</span>
                                                  ) : (
                                                    <span className="text-gray-500">Unpaid</span>
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === 'cancellations' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Reschedule / Cancellation Log</h2>
                <p className="text-sm text-gray-500">List of all canceled sessions in the last 90 days.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {scheduleLessons.filter(l => (l.status || '').toLowerCase().includes('cancel')).length === 0 ? (
                      <tr><td colSpan="4" className="px-6 py-6 text-center text-sm text-gray-500">No cancellations</td></tr>
                    ) : (
                      scheduleLessons
                        .filter(l => (l.status || '').toLowerCase().includes('cancel'))
                        .sort((a,b) => new Date(b.dateTime) - new Date(a.dateTime))
                        .map(l => (
                          <tr key={l.id}>
                            <td className="px-6 py-3 whitespace-nowrap">{new Date(l.dateTime).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-gray-900">{l.student ? `${l.student.firstName} ${l.student.lastName}` : '-'}</td>
                            <td className="px-6 py-3 whitespace-nowrap">{l.subject || '-'}</td>
                            <td className="px-6 py-3 whitespace-nowrap capitalize">{l.status}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeReport === 'studentStatement' && (
            <>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-end">
                <div className="flex items-center gap-2 text-sm">
                  <select
                    value={stmtStudentId}
                    onChange={(e) => setStmtStudentId(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-0"
                  >
                    <option value="">Select student</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                    ))}
                  </select>
                  <select
                    value={stmtMonth}
                    onChange={(e) => setStmtMonth(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-0"
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={stmtYear}
                    onChange={(e) => setStmtYear(e.target.value)}
                    className="w-24 border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-0"
                  />
                </div>
              </div>
              <div className="p-4 space-y-4">
                {studentStatement && (
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {`${studentStatement.studentName || 'Student'} — ${new Date(Number(studentStatement.year), Number(studentStatement.month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
                      </h2>
                      <p className="text-sm text-gray-500">Previous balance, billed lessons, payments and ending balance.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePrintStatement}
                      className="px-3 py-1.5 rounded-md text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                    >
                      Print
                    </button>
                  </div>
                )}
                {!studentStatement ? (
                  <div className="text-sm text-gray-500">Select student and month, then click Generate.</div>
                ) : (
                  <div ref={statementRef}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="bg-white border rounded-md p-4">
                        <p className="text-xs text-gray-500">Previous Balance</p>
                        <p className={`text-xl font-semibold ${studentStatement.previousBalance < 0 ? 'text-green-700' : 'text-gray-900'}`}>${(studentStatement.previousBalance || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-white border rounded-md p-4">
                        <p className="text-xs text-gray-500">Billed</p>
                        <p className="text-xl font-semibold text-gray-900">${(studentStatement.billedThisMonth || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-white border rounded-md p-4">
                        <p className="text-xs text-gray-500">Payments</p>
                        <p className="text-xl font-semibold text-gray-900">${(studentStatement.paidThisMonth || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-white border rounded-md p-4">
                        <p className="text-xs text-gray-500">Credit Available</p>
                        <p className="text-xl font-semibold text-blue-700">${(studentStatement.creditBalance || 0).toFixed(2)}</p>
                      </div>
                      <div className="bg-white border rounded-md p-4">
                        <p className="text-xs text-gray-500">Ending Balance</p>
                        <p className={`text-xl font-semibold ${studentStatement.endingBalance < 0 ? 'text-green-700' : 'text-gray-900'}`}>${(studentStatement.endingBalance || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Lessons</h3>
                        <div className="overflow-x-auto bg-white border rounded-md">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Lesson</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {!studentStatement.lessonsThisMonth || studentStatement.lessonsThisMonth.length === 0 ? (
                                <tr><td colSpan="3" className="px-4 py-4 text-center text-sm text-gray-500">No lessons</td></tr>
                              ) : (
                                studentStatement.lessonsThisMonth
                                  .sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime))
                                  .map(l => {
                                    const start = new Date(l.dateTime)
                                    const hours = (Number(l.duration || 0) / 60) || 0
                                    return (
                                      <tr key={l.id}>
                                        <td className="px-4 py-2 whitespace-nowrap">{start.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{hours.toFixed(2)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{typeof l.price === 'number' ? `$${l.price.toFixed(2)}` : '-'}</td>
                                      </tr>
                                    )
                                  })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Payments</h3>
                        <div className="overflow-x-auto bg-white border rounded-md">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {studentStatement.payments.length === 0 ? (
                                <tr><td colSpan="2" className="px-4 py-4 text-center text-sm text-gray-500">No payments</td></tr>
                              ) : (
                                studentStatement.payments.map(p => (
                                  <tr key={p.id}>
                                    <td className="px-4 py-2 whitespace-nowrap">{new Date(p.date).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}</td>
                                    <td className="px-4 py-2 whitespace-nowrap">${(p.amount || 0).toFixed(2)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      
    </div>
  )
}

