import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

export function Disclaimer() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Information Collection Disclaimer</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-sm max-w-none space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Purpose of This Disclaimer</h2>
              <p>
                This Information Collection Disclaimer provides transparency about the types of information collected by Resolventum, how it is used, and your rights regarding this information. This document supplements our Privacy Policy and Terms of Use.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Types of Information Collected</h2>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.1 Account Information</h3>
              <p>When you create an account, we collect:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Full name and email address</li>
                <li>Company or business name (if provided)</li>
                <li>Phone number (if provided)</li>
                <li>Password (encrypted and stored securely)</li>
                <li>Profile picture or logo (if uploaded)</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.2 Student Information</h3>
              <p>As an educator using our Service, you may input the following student information:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Student names</li>
                <li>Contact information (phone, email, address)</li>
                <li>Date of birth</li>
                <li>Parent or guardian information</li>
                <li>Academic records and progress notes</li>
                <li>Lesson schedules and attendance records</li>
                <li>Payment and billing information</li>
                <li>Medical or special needs information (if provided)</li>
              </ul>
              <p className="mt-2">
                <strong>Important:</strong> By inputting student information into Resolventum, you acknowledge that you have obtained all necessary consents and permissions from students, parents, or guardians as required by applicable laws and regulations.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.3 Financial Information</h3>
              <p>We collect and process financial information including:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Payment transaction records</li>
                <li>Billing addresses</li>
                <li>Invoice and receipt data</li>
                <li>Outstanding balances and payment history</li>
                <li>Package purchase information</li>
              </ul>
              <p className="mt-2">
                <strong>Note:</strong> We do not store full credit card numbers. Payment processing is handled by secure third-party payment processors.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">2.4 Usage and Technical Information</h3>
              <p>Automatically collected technical information includes:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>IP addresses and device identifiers</li>
                <li>Browser type and version</li>
                <li>Operating system information</li>
                <li>Pages visited and time spent on pages</li>
                <li>Click patterns and navigation paths</li>
                <li>Error logs and performance data</li>
                <li>Date and time stamps of activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How Information Is Used</h2>
              <p>The information we collect is used for the following purposes:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Service Provision:</strong> To provide, maintain, and improve the tutoring management features</li>
                <li><strong>Account Management:</strong> To create and manage user accounts, authenticate users, and provide customer support</li>
                <li><strong>Communication:</strong> To send service-related notifications, updates, and respond to inquiries</li>
                <li><strong>Financial Processing:</strong> To process payments, generate invoices, and manage billing</li>
                <li><strong>Analytics:</strong> To analyze usage patterns, improve user experience, and develop new features</li>
                <li><strong>Security:</strong> To detect, prevent, and address security issues and fraudulent activity</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Storage and Location</h2>
              <p>
                Your information is stored on secure servers. Data may be stored in locations outside your jurisdiction. By using Resolventum, you consent to the transfer and storage of your information in these locations.
              </p>
              <p className="mt-2">
                We implement industry-standard security measures including encryption, access controls, and regular security audits to protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Services</h2>
              <p>
                Resolventum may integrate with third-party services that collect information. These services have their own privacy policies and information collection practices. We are not responsible for the privacy practices of third-party services.
              </p>
              <p className="mt-2">Third-party services we may use include:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Payment processors</li>
                <li>Email service providers</li>
                <li>Cloud storage providers</li>
                <li>Analytics services</li>
                <li>Calendar integration services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Your Responsibilities</h2>
              <p>As a user of Resolventum, you are responsible for:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Ensuring you have proper authorization to input student information</li>
                <li>Complying with all applicable privacy laws (including FERPA, COPPA, GDPR, etc.)</li>
                <li>Obtaining necessary consents from students, parents, or guardians before collecting their information</li>
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>Notifying us immediately of any unauthorized access to your account</li>
                <li>Ensuring the accuracy of information you provide</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
              <p>
                We retain your information for as long as necessary to provide the Service and fulfill the purposes outlined in this disclaimer. When you delete your account, we will delete or anonymize your personal information in accordance with our data retention policies, except where retention is required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Access the information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your information</li>
                <li>Export your data in a portable format</li>
                <li>Object to certain processing activities</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, contact us at{' '}
                <a href="mailto:resolventum@gmail.com" className="text-indigo-600 hover:text-indigo-800">
                  resolventum@gmail.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Children's Information</h2>
              <p>
                If you input information about children under the age of 13, you represent and warrant that you have obtained proper parental consent as required by the Children's Online Privacy Protection Act (COPPA) and other applicable laws. We do not knowingly collect information directly from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Security Measures</h2>
              <p>We implement various security measures to protect your information:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and audits</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure backup and disaster recovery procedures</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Disclaimer</h2>
              <p>
                We may update this Information Collection Disclaimer from time to time. We will notify you of material changes by posting the updated disclaimer on this page and updating the "Last updated" date. Your continued use of the Service after such changes constitutes acceptance of the updated disclaimer.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Information</h2>
              <p>
                If you have questions about our information collection practices, please contact us at{' '}
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

