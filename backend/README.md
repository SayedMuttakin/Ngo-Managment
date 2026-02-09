# NGO Management System - Backend API

A comprehensive backend API for NGO Management System built with Node.js, Express.js, and MongoDB.

## Features

- 🔐 **Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (Admin, Manager, Collector)
  - Secure password hashing with bcrypt
  - Login with email or phone number

- 👥 **User Management**
  - User registration and login
  - Profile management
  - Password change functionality
  - Account activation/deactivation

- 🛡️ **Security**
  - Helmet for security headers
  - Rate limiting
  - CORS configuration
  - Input validation and sanitization

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting
- **Password Hashing**: bcryptjs

## Project Structure

```
backend/
├── middleware/          # Custom middleware
│   ├── auth.js         # Authentication middleware
│   └── validation.js   # Input validation middleware
├── models/             # Database models
│   └── User.js         # User model
├── routes/             # API routes
│   ├── auth.js         # Authentication routes
│   ├── members.js      # Members management routes
│   ├── products.js     # Products management routes
│   ├── installments.js # Installments routes
│   ├── savings.js      # Savings routes
│   └── dashboard.js    # Dashboard routes
├── utils/              # Utility functions
│   └── jwt.js          # JWT utilities
├── .env                # Environment variables
├── .gitignore          # Git ignore file
├── package.json        # Dependencies and scripts
├── server.js           # Main server file
└── README.md           # This file
```

## Installation

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory and add:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/ngo_management
   FRONTEND_URL=http://localhost:5173
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the server**
   ```bash
   # Development mode with nodemon
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/register` | Register new user | Public |
| POST | `/login` | User login | Public |
| GET | `/me` | Get current user | Private |
| PUT | `/profile` | Update user profile | Private |
| PUT | `/change-password` | Change password | Private |
| POST | `/logout` | User logout | Private |
| GET | `/check` | Check authentication | Private |

### Other Routes (Coming Soon)

- `/api/members` - Members management
- `/api/products` - Products management
- `/api/installments` - Installments management
- `/api/savings` - Savings management
- `/api/dashboard` - Dashboard statistics

## User Roles

- **Admin**: Full system access
- **Manager**: Manage members, products, and collections
- **Collector**: Collect installments and manage assigned members

## Request/Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [...]
}
```

## Authentication

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Development

1. **Install nodemon for development**
   ```bash
   npm install -g nodemon
   ```

2. **Run in development mode**
   ```bash
   npm run dev
   ```

3. **API Health Check**
   Visit `http://localhost:5000/api/health` to check if the API is running.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment mode | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/ngo_management |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:5173 |
| `JWT_SECRET` | JWT secret key | Required |
| `JWT_EXPIRE` | JWT expiration time | 7d |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License.
