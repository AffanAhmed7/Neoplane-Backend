import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

interface CustomError extends Error {
  statusCode?: number;
}

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Differentiate specific database errors from Prisma
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'A resource with that unique constraint already exists.';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Resource not found.';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Foreign key constraint failed.';
    }
  }

  // Handle unauthorized or unauthenticated formally
  if (err.name === 'UnauthorizedError' || statusCode === 401) {
    statusCode = 401;
    message = message === 'Internal Server Error' ? 'Unauthorized access' : message;
  }

  // Handle forbidden access formally
  if (statusCode === 403) {
    message = message === 'Internal Server Error' ? 'Forbidden access' : message;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Centralized context-aware logging
  console.error(`[Error] ${statusCode} | ${req.method} ${req.originalUrl} | ${message}`);
  
  if (isDevelopment && err.stack) {
    console.error(err.stack);
    // Write to a local file for the AI assistant to read since I can't see the terminal
    const logEntry = `\n[${new Date().toISOString()}] ${statusCode} | ${req.method} ${req.originalUrl}\n${err.stack}\n${'-'.repeat(50)}\n`;
    fs.appendFileSync(path.join(process.cwd(), 'crash-report.txt'), logEntry);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(isDevelopment && { stack: err.stack }),
  });
};

