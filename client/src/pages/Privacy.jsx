import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

export function Privacy() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-sm max-w-none space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
              <p>
                Resolventum ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our tutoring management system.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.1 Personal Information</h3>
              <p>We may collect personal information that you provide to us, including:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Name and contact information (email address, phone number)</li>
                <li>Company or business name</li>
                <li>Account credentials (username, password)</li>
                <li>Payment and billing information</li>
                <li>Profile information and preferences</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.2 Student Information</h3>
              <p>As part of the Service, you may input student information including:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Student names and contact information</li>
                <li>Date of birth</li>
                <li>Lesson schedules and attendance records</li>
                <li>Payment and billing history</li>
                <li>Academic progress and notes</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.3 Usage Data</h3>
              <p>We automatically collect certain information when you use the Service, including:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Pages visited and time spent on pages</li>
                <li>Date and time of access</li>
                <li>Referring website addresses</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process transactions and send related information</li>
                <li>Send administrative information and updates</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Monitor and analyze usage patterns and trends</li>
                <li>Detect, prevent, and address technical issues</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Storage and Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.
              </p>
              <p className="mt-2">
                Your data is stored on secure servers and is encrypted in transit using industry-standard protocols. We regularly review and update our security practices to maintain the highest level of protection.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Sharing and Disclosure</h2>
              <p>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Service Providers:</strong> With trusted third-party service providers who assist us in operating the Service</li>
                <li><strong>Legal Requirements:</strong> When required by law or to respond to legal process</li>
                <li><strong>Protection of Rights:</strong> To protect our rights, privacy, safety, or property</li>
                <li><strong>Business Transfers:</strong> In connection with any merger, sale, or transfer of assets</li>
                <li><strong>With Your Consent:</strong> When you have given us explicit permission to share your information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Your Rights and Choices</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Access and review your personal information</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Request deletion of your personal information</li>
                <li>Object to processing of your personal information</li>
                <li>Request restriction of processing</li>
                <li>Data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:resolventum@gmail.com" className="text-indigo-600 hover:text-indigo-800">
                  resolventum@gmail.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Cookies and Tracking Technologies</h2>
              <p>
                We use cookies and similar tracking technologies to track activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Children's Privacy</h2>
              <p>
                Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. International Data Transfers</h2>
              <p>
                Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. By using the Service, you consent to the transfer of your information to these facilities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Privacy Policy</h2>
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at{' '}
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

