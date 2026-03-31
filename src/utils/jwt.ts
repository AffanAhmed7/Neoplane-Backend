import jwt from 'jsonwebtoken';

/**
 * JWT utility for access and refresh tokens.
 * Access Token: 15 min (Short lived)
 * Refresh Token: 7 days (Long lived)
 */

interface TokenPayload {
  userId: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: '15m',
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: '7d',
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
};
