# Resolventum - Tutoring Business Management System

A comprehensive web application for managing tutoring businesses with features for tracking students, scheduling lessons, managing payments, generating invoices, and automated SMS reminders.

## Features

- **Student Management**: Track all your students with contact information and notes
- **Lesson Scheduling**: Schedule, reschedule, and manage lessons with subject tracking
- **Package Management**: Create and manage lesson packages for students
- **Payment Tracking**: Record all payments with multiple payment methods
- **Automated SMS Reminders**: Automatic text message reminders sent to students the day before their lessons
- **Invoice Generation**: Generate PDF invoices for individual students at the end of each month
- **Monthly Reports**: Comprehensive reports showing lessons, payments, and revenue
- **Modern Dashboard**: Overview of all key metrics and upcoming lessons

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL with Prisma ORM
- JWT Authentication
- Twilio for SMS integration
- PDF generation for invoices
- Scheduled jobs for automated reminders

### Frontend
- React 18
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- React Query for data fetching
- Lucide React for icons
- React Hot Toast for notifications

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Twilio account (for SMS features)

### Installation

1. **Clone the repository** (or navigate to the project directory)

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up the database**
   
   Create a PostgreSQL database:
   ```bash
   createdb resolventum
   ```

   Configure your database connection in `server/.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/resolventum"
   JWT_SECRET="your-secret-key-here"
   ```

4. **Run database migrations**
   ```bash
   cd server
   npx prisma migrate dev --name init
   npx prisma generate
   ```

5. **Configure Twilio (optional, for SMS reminders)**
   
   Add your Twilio credentials to `server/.env`:
   ```
   TWILIO_ACCOUNT_SID="your-account-sid"
   TWILIO_AUTH_TOKEN="your-auth-token"
   TWILIO_PHONE_NUMBER="your-twilio-number"
   ```

6. **Start the development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:5001`
   - Frontend development server on `http://localhost:3000`

### First Time Setup

1. Open your browser and navigate to `http://localhost:3000`
2. Register a new account
3. Start adding students and scheduling lessons!

## Project Structure

```
Resolventum/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context providers
│   │   ├── utils/         # Utility functions
│   │   └── App.jsx        # Main app component
│   └── package.json
├── server/                # Node.js backend
│   ├── routes/            # API routes
│   ├── middleware/        # Express middleware
│   ├── jobs/              # Scheduled jobs
│   ├── utils/             # Utility functions
│   ├── prisma/            # Database schema
│   └── package.json
└── package.json           # Root package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get single student
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Lessons
- `GET /api/lessons` - Get all lessons
- `POST /api/lessons` - Schedule lesson
- `PUT /api/lessons/:id` - Update lesson
- `DELETE /api/lessons/:id` - Delete lesson
- `GET /api/lessons/upcoming/tomorrow` - Get tomorrow's lessons

### Payments
- `GET /api/payments` - Get all payments
- `POST /api/payments` - Record payment
- `PUT /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment

### Packages
- `GET /api/packages` - Get all packages
- `POST /api/packages` - Create package
- `PUT /api/packages/:id` - Update package

### Invoices
- `POST /api/invoices/generate/:studentId` - Generate invoice PDF
- `GET /api/invoices/data/:studentId` - Get invoice data

### Reports
- `GET /api/reports/monthly` - Get monthly report

## Usage Guide

### Adding a Student
1. Navigate to the "Students" page
2. Click "Add Student"
3. Fill in the student's information
4. Save

### Scheduling a Lesson
1. Navigate to "Lessons"
2. Click "Schedule Lesson"
3. Select student, date/time, duration, subject, and price
4. Save

### Recording a Payment
1. Navigate to "Payments"
2. Click "Record Payment"
3. Select student, enter amount, payment method, and date
4. Save

### Generating an Invoice
1. Navigate to "Payments"
2. Find the student's payment
3. Click "Invoice" to download PDF

### Viewing Reports
1. Navigate to "Reports"
2. Select the month and year
3. View comprehensive breakdown of lessons, payments, and revenue
4. Download report if needed

## SMS Reminders

The system automatically sends SMS reminders to students 24 hours before their scheduled lessons. This runs as a scheduled job every day at 6 PM.

To enable SMS reminders:
1. Sign up for a Twilio account
2. Get your Account SID and Auth Token
3. Add them to `server/.env`
4. The reminders will start working automatically

## Production Deployment

### Environment Setup
- Set `NODE_ENV=production`
- Use a production database
- Set up proper CORS configuration
- Use secure JWT secrets

### Database
- Run `npx prisma migrate deploy` in production
- Generate Prisma client: `npx prisma generate`

### Build Frontend
```bash
cd client
npm run build
```

### Start Server
```bash
cd server
npm start
```

## License

This project is proprietary software for tutoring business management.

## Support

For issues or questions, please contact the development team.
