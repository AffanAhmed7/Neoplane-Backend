import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

/**
 * Controller for authentication-related endpoints.
 * Thin wrapper that validates request and delegates to AuthService.
 */
export class AuthController {
  /**
   * Register a new user.
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.registerUser(req.body);
      res.status(201).json({
        status: 'success',
        message: 'Registration successful',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log in a user and return tokens.
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const data = await AuthService.loginUser(email, password);

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log in a user via Google.
   */
  static async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = req.body;
      const data = await AuthService.googleLogin(idToken);

      res.status(200).json({
        status: 'success',
        message: 'Google login successful',
        data,
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Refresh the access token using a refresh token.
   */
  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const data = await AuthService.refreshToken(refreshToken);

      res.status(200).json({
        status: 'success',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user and clear tokens.
   */
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Assuming userId is attached to the request by the auth middleware
      const userId = (req as any).user?.userId;
      if (userId) {
        await AuthService.logout(userId);
      }

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current authenticated user details.
   */
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: 'Not authenticated',
        });
      }

      const user = await AuthService.getUserById(userId);
      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }
}
