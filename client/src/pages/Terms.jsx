import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

export function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/login" className="flex items-center">
                <div className="bg-indigo-600 rounded-lg p-2 mr-3">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Resolventum</h1>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Use</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-sm max-w-none space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Resolventum ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Use License</h2>
              <p>
                Permission is granted to temporarily use Resolventum for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display</li>
                <li>Attempt to reverse engineer any software contained in Resolventum</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
                <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
              <p>
                To access certain features of the Service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and identification</li>
                <li>Accept all responsibility for activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. User Responsibilities</h2>
              <p>
                You are responsible for all activities that occur under your account. You agree to:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Use the Service only for lawful purposes</li>
                <li>Not use the Service to transmit any harmful or malicious code</li>
                <li>Not interfere with or disrupt the Service or servers connected to the Service</li>
                <li>Not attempt to gain unauthorized access to any portion of the Service</li>
                <li>Comply with all applicable local, state, national, and international laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data and Content</h2>
              <p>
                You retain ownership of all data and content you upload to Resolventum. By using the Service, you grant us a license to store, process, and display your data as necessary to provide the Service. You are solely responsible for backing up your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Service Availability</h2>
              <p>
                We strive to provide continuous availability of the Service but do not guarantee uninterrupted access. The Service may be unavailable due to maintenance, updates, or circumstances beyond our control.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Termination</h2>
              <p>
                We reserve the right to terminate or suspend your account and access to the Service immediately, without prior notice, for conduct that we believe violates these Terms of Use or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Disclaimer</h2>
              <p>
                The materials on Resolventum are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
              <p>
                In no event shall Resolventum or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the Service, even if we have been notified orally or in writing of the possibility of such damage.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms of Use at any time. We will notify users of any material changes by posting the new Terms of Use on this page. Your continued use of the Service after such modifications constitutes your acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact Information</h2>
              <p>
                If you have any questions about these Terms of Use, please contact us at{' '}
                <a href="mailto:resolventum@gmail.com" className="text-indigo-600 hover:text-indigo-800">
                  resolventum@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolventum</h3>
              <p className="text-sm text-gray-600 mb-2">
                Tutoring Management System
              </p>
              <p className="text-sm text-gray-600">
                <a 
                  href="mailto:resolventum@gmail.com" 
                  className="text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  resolventum@gmail.com
                </a>
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link 
                    to="/terms" 
                    className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/privacy" 
                    className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/disclaimer" 
                    className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
                  >
                    Information Collection Disclaimer
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">About</h3>
              <p className="text-sm text-gray-600 mb-2">
                Resolventum is a comprehensive tutoring management system designed to help educators manage students, lessons, payments, and reports efficiently.
              </p>
              <p className="text-sm text-gray-500 mt-4">
                © {new Date().getFullYear()} Resolventum. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

