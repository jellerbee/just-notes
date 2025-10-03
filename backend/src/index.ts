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
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
import notesRouter from './routes/notes';
import annotationsRouter from './routes/annotations';
import redactRouter from './routes/redact';
import searchRouter from './routes/search';

// Routes
app.use('/notes', notesRouter);
app.use('/annotations', annotationsRouter);
app.use('/redact', redactRouter);
app.use('/search', searchRouter);

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
