import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Fix BigInt serialization for JSON responses
(BigInt.prototype as any).toJSON = function() {
  return Number(this);
};

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
import authRouter from './routes/auth';
import notesRouter from './routes/notes';
import annotationsRouter from './routes/annotations';
import redactRouter from './routes/redact';
import searchRouter from './routes/search';
import { authenticateToken } from './middleware/auth';

// Public routes (no auth required)
app.use('/auth', authRouter);

// Protected routes (auth required in production)
app.use('/notes', authenticateToken, notesRouter);
app.use('/annotations', authenticateToken, annotationsRouter);
app.use('/redact', authenticateToken, redactRouter);
app.use('/search', authenticateToken, searchRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});
