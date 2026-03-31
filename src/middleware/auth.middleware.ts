import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

/**
 * Middleware to protect routes and verify the JWT access token.
 * Extracts Bearer token from the Authorization header and attaches the user payload to the request object.
 */

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Authorization token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    // Attach user information to the request
    (req as any).user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired access token',
    });
  }
};
