import dotenv from 'dotenv';
// Load environment variables immediately
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import { errorMiddleware } from './middleware/error.middleware';
import { connectDB } from './config/database';
import authRouter from './routes/auth.routes';
import conversationRouter from './routes/conversation.routes';
import messageRouter from './routes/message.routes';
import fileRouter from './routes/file.routes';
import searchRouter from './routes/search.routes';
import notificationRouter from './routes/notification.routes';
import userRouter from './routes/user.routes';
import friendRouter from './routes/friend.routes';
import { apiLimiter, messageLimiter, fileLimiter } from './middleware/rate-limit.middleware';
import { setupSockets } from './sockets/index';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (e.g., Nginx, AWS ELB, Heroku) for accurate IP tracking in Rate Limiting
app.set('trust proxy', 1);

// Initialize Database Connection
connectDB();

// 1. Standard production-ready middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173', 
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Global Rate Limiting - Apply 100 req/min limit to all generic /api routes
app.use('/api/', apiLimiter);

// 2. Core Routes
app.use('/api/auth', authRouter);
app.use('/api/conversations', conversationRouter);

// Apply strict 30 req/min message limit
app.use('/api/messages', messageLimiter, messageRouter);

// Apply strict 5 req/min media upload limit
app.use('/api/files', fileLimiter, fileRouter);

app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/users', userRouter);
app.use('/api/friends', friendRouter);

// 3. Main health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'NeoPlane Backend'
  });
});

// 4. Initialize Socket.io
setupSockets(server);

// 5. Global error handling middleware (must be after all routes)
app.use(errorMiddleware);

// 6. App server entry point
server.listen(PORT, () => {
  console.log(`[Server] NeoPlane Backend running on port ${PORT}`);
});

export default app;
