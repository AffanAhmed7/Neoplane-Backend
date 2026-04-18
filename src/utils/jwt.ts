import jwt from 'jsonwebtoken';

/**
 * JWT utility for access and refresh tokens.
 * Access Token: 7 days (Long lived for better UX)
 * Refresh Token: 30 days (Very long lived)
 */

interface TokenPayload {
  userId: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: '7d',
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: '30d',
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
};
