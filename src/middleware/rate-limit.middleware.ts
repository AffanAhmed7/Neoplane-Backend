import rateLimit from 'express-rate-limit';

/**
 * Standardizes the rate limit error response to match the global JSON format.
 */
const rateLimitHandler = (req: any, res: any) => {
  res.status(429).json({
    status: 'error',
    message: 'Too many requests, please try again later.',
  });
};

/**
 * Global API Limiter
 * Restricts standard endpoint usage to 100 requests per 15 minutes per IP.
 * Used for general endpoint protection against spam/DDoS.
 */
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // Limit each IP to 1000 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: rateLimitHandler,
});

/**
 * Strict Message Limiter
 * Restricts message sending to 30 requests per minute to prevent spamming conversations.
 */
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // Limit each IP to 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: any, res: any) => {
    res.status(429).json({
      status: 'error',
      message: 'Message rate limit exceeded. Please wait before sending more.',
    });
  },
});

/**
 * Strict File Upload Limiter
 * Restricts media uploads to 5 per minute due to S3 and bandwidth costs.
 */
export const fileLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 uploads per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: any, res: any) => {
    res.status(429).json({
      status: 'error',
      message: 'Upload rate limit exceeded. Maximum 5 uploads per minute.',
    });
  },
});
