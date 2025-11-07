import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { Download, X } from 'lucide-react'
import toast from 'react-hot-toast'
import html2pdf from 'html2pdf.js'

export function Statement() {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [statementData, setStatementData] = useState(null)
  const [savingPdf, setSavingPdf] = useState(false)
  const contentRef = useRef(null)

  useEffect(() => {
    loadStatement()
  }, [studentId])

  const loadStatement = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/reports/balance-statement/${studentId}`)
      setStatementData(data)
    } catch (error) {
      console.error('Failed to load statement:', error)
      toast.error('Failed to load statement')
      navigate('/reports')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  const handleSaveAsPdf = async () => {
    if (!contentRef.current) {
      toast.error('Content not ready')
      return
    }

    try {
      setSavingPdf(true)
      toast.loading('Generating PDF...', { id: 'pdf-generation' })

      // Wait a bit to ensure all content is rendered, especially images
      await new Promise(resolve => setTimeout(resolve, 500))

      const element = contentRef.current
      const studentName = statementData.isFamily 
        ? statementData.student.firstName 
        : `${statementData.student.firstName} ${statementData.student.lastName || ''}`.trim()
      
      const filename = `balance-statement-${studentName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`

      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'in', 
          format: 'letter', 
          orientation: 'portrait' 
        }
      }

      await html2pdf().set(opt).from(element).save()
      
      toast.success('PDF saved successfully', { id: 'pdf-generation' })
    } catch (error) {
      console.error('Failed to generate PDF:', error)
      toast.error('Failed to save PDF', { id: 'pdf-generation' })
    } finally {
      setSavingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading statement...</p>
        </div>
      </div>
    )
  }

  if (!statementData) {
    return null
  }

  const totalBilled = statementData.completedLessons.reduce((sum, lesson) => sum + (lesson.price || 0), 0)
  const totalPaid = statementData.completedLessons.reduce((sum, lesson) => {
    const lessonPaid = lesson.payments.reduce((pSum, payment) => pSum + (payment.amount || 0), 0)
    return sum + lessonPaid
  }, 0)
  const outstandingBalance = totalBilled - totalPaid

  const studentName = statementData.isFamily 
    ? statementData.student.firstName 
    : `${statementData.student.firstName} ${statementData.student.lastName || ''}`.trim()

  return (
    <div className="min-h-screen bg-white" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {/* Print controls - hidden when printing */}
      <div id="print-controls" className="print:hidden bg-gray-100 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Account Balance Statement</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAsPdf}
            disabled={savingPdf}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-2" />
            {savingPdf ? 'Saving...' : 'Save as PDF'}
          </button>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </button>
        </div>
      </div>

      {/* Statement content */}
      <div ref={contentRef} className="max-w-4xl mx-auto px-6 py-8 print:px-0 print:py-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 print:mb-6">
          <div>
            {statementData.logoUrl && (
              <img 
                src={statementData.logoUrl.startsWith('http') ? statementData.logoUrl : statementData.logoUrl} 
                alt={statementData.companyName || 'Company logo'} 
                className="h-16 w-auto mb-4 print:h-12"
                style={{ maxWidth: '200px', height: 'auto' }}
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
                onLoad={() => {
                  // Ensure image is loaded before printing
                  console.log('Logo loaded')
                }}
              />
            )}
          </div>
          <div className="text-right">
            {statementData.companyName && (
              <h2 className="text-2xl font-bold text-gray-900 mb-2 print:text-xl">{statementData.companyName}</h2>
            )}
            {statementData.companyAddress && (
              <div className="text-sm text-gray-600 mb-1 print:text-xs">
                {statementData.companyAddress.split('\n').map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            )}
            {statementData.companyPhone && (
              <div className="text-sm text-gray-600 print:text-xs">Phone: {statementData.companyPhone}</div>
            )}
            {statementData.companyEmail && (
              <div className="text-sm text-gray-600 print:text-xs">Email: {statementData.companyEmail}</div>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="mb-6 print:mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 print:text-2xl">ACCOUNT BALANCE STATEMENT</h1>
          <p className="text-sm text-gray-600 print:text-xs">
            Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Account Holder Info */}
        <div className="mb-6 print:mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 print:text-base">Account Holder:</h3>
          <div className="ml-4">
            <p className="text-base text-gray-900 print:text-sm">{studentName}</p>
            {statementData.isFamily && statementData.familyStudents && (
              <p className="text-sm text-gray-600 italic print:text-xs mt-1">
                Family Members: {statementData.familyStudents.map(s => `${s.firstName} ${s.lastName}`).join(', ')}
              </p>
            )}
            {statementData.student.email && (
              <p className="text-sm text-gray-600 print:text-xs">Email: {statementData.student.email}</p>
            )}
            {statementData.student.phone && (
              <p className="text-sm text-gray-600 print:text-xs">Phone: {statementData.student.phone}</p>
            )}
          </div>
        </div>

        {/* Balance Summary */}
        <div className="border-2 border-gray-300 rounded-lg p-6 mb-8 print:mb-6 print:border print:p-4">
          <h3 className="text-xl font-bold text-gray-900 mb-4 print:text-lg">BALANCE SUMMARY</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-base text-gray-700 print:text-sm">Total Billed:</span>
              <span className="text-lg font-bold text-gray-900 print:text-base">{formatCurrency(totalBilled)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base text-gray-700 print:text-sm">Total Paid:</span>
              <span className="text-lg font-bold text-green-700 print:text-base">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between items-center border-t-2 border-gray-300 pt-3 print:border-t print:pt-2">
              <span className="text-lg font-bold text-gray-900 print:text-base">Outstanding Balance:</span>
              <span className={`text-xl font-bold print:text-lg ${
                outstandingBalance > 0 ? 'text-red-600' : outstandingBalance < 0 ? 'text-green-600' : 'text-gray-900'
              }`}>
                {formatCurrency(outstandingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Information - Prominent Display */}
        {(statementData.venmo || statementData.zelle) && (
          <div className="border-2 border-indigo-500 bg-indigo-50 rounded-lg p-6 mb-8 print:mb-6 print:border-2 print:bg-indigo-50 print:p-4">
            <h3 className="text-xl font-bold text-indigo-900 mb-4 print:text-lg">PAYMENT METHODS</h3>
            <div className="space-y-3 print:space-y-2">
              {statementData.venmo && (
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-indigo-900 print:text-sm min-w-[80px]">Venmo:</span>
                  <span className="text-lg font-bold text-indigo-700 print:text-base">{statementData.venmo}</span>
                </div>
              )}
              {statementData.zelle && (
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold text-indigo-900 print:text-sm min-w-[80px]">Zelle:</span>
                  <span className="text-lg font-bold text-indigo-700 print:text-base">{statementData.zelle}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completed Lessons */}
        {statementData.completedLessons.length > 0 && (
          <div className="mb-8 print:mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 print:text-lg">COMPLETED LESSONS</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 print:text-xs">
                    <thead>
                  <tr className="bg-gray-100 print:bg-gray-200">
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                    {statementData.isFamily && (
                      <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Student</th>
                    )}
                    <th className="border border-gray-300 px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Duration</th>
                    <th className="border border-gray-300 px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Price</th>
                    <th className="border border-gray-300 px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Paid</th>
                    <th className="border border-gray-300 px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData.completedLessons
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map((lesson, index) => {
                      const lessonPaid = lesson.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
                      const lessonBalance = (lesson.price || 0) - lessonPaid
                      return (
                        <tr key={lesson.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 print:text-xs">
                            {new Date(lesson.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </td>
                          {statementData.isFamily && (
                            <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600 print:text-xs">{lesson.studentName || '-'}</td>
                          )}
                          <td className="border border-gray-300 px-3 py-2 text-sm text-right text-gray-900 print:text-xs">{lesson.duration || '-'} min</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-right text-gray-900 print:text-xs">{formatCurrency(lesson.price || 0)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-sm text-right text-green-700 print:text-xs">{formatCurrency(lessonPaid)}</td>
                          <td className={`border border-gray-300 px-3 py-2 text-sm text-right font-semibold print:text-xs ${
                            lessonBalance > 0 ? 'text-red-600' : lessonBalance < 0 ? 'text-green-600' : 'text-gray-900'
                          }`}>
                            {formatCurrency(lessonBalance)}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment History */}
        {statementData.allPayments.length > 0 && (
          <div className="mb-8 print:mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 print:text-lg">PAYMENT HISTORY</h3>
            <div className="space-y-2 print:space-y-1">
              {statementData.allPayments
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((payment) => (
                  <div key={payment.id} className="text-sm text-gray-700 print:text-xs border-b border-gray-200 pb-2 print:pb-1">
                    <span className="font-semibold">
                      {new Date(payment.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })} - {payment.method || 'N/A'} - {formatCurrency(payment.amount)}
                    </span>
                    {payment.notes && (
                      <span className="text-gray-600 ml-2">({payment.notes})</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 print:mt-6 print:pt-2">
          <p className="text-xs text-gray-500 italic print:text-[10px]">
            This is an automated statement. Please contact us if you have any questions.
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            margin: 1cm;
            size: letter;
          }
          
          * {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body {
            background: white !important;
            color: black !important;
          }
          
          /* Hide print controls */
          .print\\:hidden,
          [class*="print:hidden"],
          #print-controls {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
          }
          
          /* Ensure main container is visible */
          .min-h-screen {
            min-height: auto !important;
            background: white !important;
          }
          
          /* Header adjustments */
          .print\\:h-12,
          [class*="print:h-12"] {
            height: 3rem !important;
            max-height: 3rem !important;
          }
          
          /* Text sizes */
          .print\\:text-xs,
          [class*="print:text-xs"] {
            font-size: 0.75rem !important;
          }
          
          .print\\:text-sm,
          [class*="print:text-sm"] {
            font-size: 0.875rem !important;
          }
          
          .print\\:text-base,
          [class*="print:text-base"] {
            font-size: 1rem !important;
          }
          
          .print\\:text-lg,
          [class*="print:text-lg"] {
            font-size: 1.125rem !important;
          }
          
          .print\\:text-xl,
          [class*="print:text-xl"] {
            font-size: 1.25rem !important;
          }
          
          .print\\:text-2xl,
          [class*="print:text-2xl"] {
            font-size: 1.5rem !important;
          }
          
          /* Spacing */
          .print\\:mb-2,
          [class*="print:mb-2"] {
            margin-bottom: 0.5rem !important;
          }
          
          .print\\:mb-4,
          [class*="print:mb-4"] {
            margin-bottom: 1rem !important;
          }
          
          .print\\:mb-6,
          [class*="print:mb-6"] {
            margin-bottom: 1.5rem !important;
          }
          
          .print\\:mt-6,
          [class*="print:mt-6"] {
            margin-top: 1.5rem !important;
          }
          
          .print\\:p-4,
          [class*="print:p-4"] {
            padding: 1rem !important;
          }
          
          .print\\:py-4,
          [class*="print:py-4"] {
            padding-top: 1rem !important;
            padding-bottom: 1rem !important;
          }
          
          .print\\:px-0,
          [class*="print:px-0"] {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          
          .print\\:pb-1,
          [class*="print:pb-1"] {
            padding-bottom: 0.25rem !important;
          }
          
          .print\\:pt-2,
          [class*="print:pt-2"] {
            padding-top: 0.5rem !important;
          }
          
          /* Borders */
          .print\\:border,
          [class*="print:border"] {
            border-width: 1px !important;
          }
          
          .print\\:border-t,
          [class*="print:border-t"] {
            border-top-width: 1px !important;
          }
          
          /* Backgrounds */
          .print\\:bg-white,
          [class*="print:bg-white"] {
            background: white !important;
          }
          
          .print\\:bg-gray-200,
          [class*="print:bg-gray-200"],
          thead tr {
            background-color: #e5e7eb !important;
          }
          
          .print\\:bg-indigo-50,
          [class*="print:bg-indigo-50"] {
            background-color: #eef2ff !important;
          }
          
          .print\\:border-indigo-500,
          [class*="print:border-indigo-500"] {
            border-color: #6366f1 !important;
          }
          
          /* Spacing utilities */
          .print\\:space-y-1 > * + *,
          [class*="print:space-y-1"] > * + * {
            margin-top: 0.25rem !important;
          }
          
          /* Font size utility */
          .print\\:text-\\[10px\\],
          [class*="print:text-[10px]"] {
            font-size: 10px !important;
          }
          
          /* Ensure tables are visible */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            display: table !important;
            visibility: visible !important;
          }
          
          thead {
            display: table-header-group !important;
          }
          
          tbody {
            display: table-row-group !important;
          }
          
          tr {
            display: table-row !important;
            page-break-inside: avoid !important;
          }
          
          th, td {
            border: 1px solid #d1d5db !important;
            padding: 0.5rem !important;
            display: table-cell !important;
            visibility: visible !important;
          }
          
          /* Ensure all content is visible */
          div, p, h1, h2, h3 {
            visibility: visible !important;
          }
          
          span {
            visibility: visible !important;
            display: inline !important;
          }
          
          .flex {
            display: flex !important;
            visibility: visible !important;
          }
          
          /* Prevent page breaks inside important sections */
          .border-2 {
            page-break-inside: avoid;
          }
          
          /* Ensure images print */
          img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  )
}


