import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * Middleware to verify JWT token
 * In development, auto-creates a demo user if no auth is provided
 * In production, requires valid JWT
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  // In development, allow unauthenticated access with a demo user
  if (process.env.NODE_ENV === 'development') {
    req.userId = 'demo-user';
    return next();
  }

  // In production, require authentication
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Generate JWT token for a user
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}
