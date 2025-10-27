#!/bin/bash

echo "🚀 Setting up Resolventum Tutoring Management System"
echo ""

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install
cd ..

# Create .env file in server if it doesn't exist
if [ ! -f server/.env ]; then
  echo "📝 Creating server/.env file..."
  cp server/.env.example server/.env
  echo "⚠️  Please edit server/.env with your database credentials and Twilio API keys"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit server/.env with your database credentials and Twilio API keys"
echo "2. Create PostgreSQL database: createdb resolventum"
echo "3. Run migrations: cd server && npx prisma migrate dev --name init"
echo "4. Start development: npm run dev"
echo ""

