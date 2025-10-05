import express from 'express';
import { generateToken } from '../middleware/auth';

const router = express.Router();

/**
 * POST /auth/demo
 * Generate a demo token for development/testing
 * In production, this would be replaced with proper login
 */
router.post('/demo', (req, res) => {
  const userId = req.body.userId || 'demo-user';
  const token = generateToken(userId);

  res.json({
    token,
    userId,
    expiresIn: '30d',
  });
});

/**
 * POST /auth/login
 * Future: Implement proper email/password login
 */
router.post('/login', (req, res) => {
  // TODO: Implement proper authentication
  // For now, just generate a demo token
  const token = generateToken('demo-user');
  res.json({ token, userId: 'demo-user' });
});

export default router;
