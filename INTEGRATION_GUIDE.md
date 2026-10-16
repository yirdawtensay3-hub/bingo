# 🚀 Frontend-Backend Integration Guide

## Overview
This guide explains how the frontend and backend are integrated for the Bingo Bot application.

## 🏗️ Architecture

```
Frontend (React + Vite)     Backend (NestJS + MongoDB)
├── Port: 5173             ├── Port: 3000
├── Telegram Mini App      ├── REST API
├── JWT Authentication     ├── JWT Authentication
└── Axios HTTP Client      └── CORS Enabled
```

## 🔧 Setup Instructions

### 1. Backend Setup
```bash
cd backend
npm install
npm run start:dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Environment Variables
Create `.env` files:

**Backend (.env):**
```env
MONGODB_URI=mongodb://localhost:27017/bingo
JWT_SECRET=your-super-secret-jwt-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
PORT=3000
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3000
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
```

## 🔐 Authentication Flow

### 1. Telegram Mini App Authentication
```typescript
// User opens app in Telegram
// Frontend detects Telegram environment
// Automatically authenticates with backend
const telegramUser = telegramService.getTelegramUser();
const response = await authAPI.authenticateFromTelegram({
  telegramId: telegramUser.id.toString(),
  username: telegramUser.username,
  firstName: telegramUser.first_name,
  lastName: telegramUser.last_name,
});
```

### 2. JWT Token Management
```typescript
// Token stored in localStorage
localStorage.setItem('auth_token', response.access_token);

// Automatically added to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 📡 API Endpoints

### Authentication
- `POST /auth/telegram` - Authenticate with Telegram data
- `GET /auth/profile` - Get current user profile (protected)

### Example Usage
```typescript
// Authenticate user
const response = await authAPI.authenticateFromTelegram(telegramData);

// Get user profile
const profile = await authAPI.getProfile();
```

## 🔄 Data Flow

1. **User opens Telegram Mini App**
2. **Frontend detects Telegram environment**
3. **Frontend gets user data from Telegram**
4. **Frontend sends user data to backend**
5. **Backend creates/finds user in database**
6. **Backend returns JWT token**
7. **Frontend stores token and user data**
8. **All subsequent requests include JWT token**

## 🛠️ Key Components

### Frontend Services
- `services/api.ts` - HTTP client with axios
- `services/telegram.ts` - Telegram Mini App integration
- `contexts/UserContext.tsx` - User state management

### Backend Modules
- `modules/auth/` - Authentication logic
- `modules/user/` - User management
- `modules/telegram/` - Telegram bot integration

## 🚨 Error Handling

### Frontend
- Loading states during authentication
- Error messages for failed requests
- Automatic token refresh
- Fallback to demo mode

### Backend
- CORS enabled for frontend communication
- JWT token validation
- User data validation
- Error responses with proper HTTP status codes

## 🧪 Testing the Integration

### 1. Start Both Servers
```bash
# Terminal 1 - Backend
cd backend && npm run start:dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 2. Test Authentication
- Open `http://localhost:5173`
- If in Telegram: Click "Login with Telegram"
- If in browser: Click "Try Demo"

### 3. Verify API Calls
- Check browser Network tab
- Verify JWT token in requests
- Check backend logs for incoming requests

## 🔧 Development Tips

### CORS Configuration
Backend is configured to allow requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Backend server)

### Proxy Configuration
Frontend Vite config includes proxy for API calls:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

### Environment Detection
```typescript
// Check if running in Telegram Mini App
if (telegramService.isTelegramApp()) {
  // Use Telegram authentication
} else {
  // Use demo mode
}
```

## 🚀 Production Deployment

### Backend
- Set production environment variables
- Configure MongoDB Atlas
- Set up Telegram bot webhook
- Deploy to Vercel/Railway/Heroku

### Frontend
- Build for production: `npm run build`
- Deploy to Vercel/Netlify
- Configure Telegram Mini App URL
- Set production API URL

## 📱 Telegram Mini App Setup

1. Create bot with @BotFather
2. Get bot token
3. Set up webhook for Mini App
4. Configure Mini App URL in bot settings
5. Test in Telegram

## 🔍 Troubleshooting

### Common Issues
1. **CORS errors** - Check backend CORS configuration
2. **Authentication fails** - Verify JWT secret matches
3. **Telegram data missing** - Check if running in Telegram environment
4. **API calls fail** - Verify backend is running and accessible

### Debug Steps
1. Check browser console for errors
2. Check backend logs
3. Verify environment variables
4. Test API endpoints with Postman/curl
5. Check network requests in browser dev tools

## 📚 Next Steps

1. Add more API endpoints for bingo rooms
2. Implement real-time features with WebSockets
3. Add user profile management
4. Implement game logic
5. Add payment integration
6. Deploy to production

This integration provides a solid foundation for building a full-featured bingo application with Telegram Mini App support!
