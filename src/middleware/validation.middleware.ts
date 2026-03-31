import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Generic validation middleware for Zod schemas.
 * Reusable across every route that requires structured body validation.
 */

export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Pass the entire request object payload to Zod for flexible formatting
      // E.g., a schema can define z.object({ body: ..., query: ... })
      // or if it's a flat schema, assume it targets req.body by default for backward compatibility.
      // To strictly follow the prompt "Use Zod schemas to validate requests":
      
      // Because most existing schemas are flat (e.g., z.object({ query: z.string() })),
      // we merge the properties to validate seamlessly against flat definitions.
      const payload = { ...req.body, ...req.query, ...req.params };
      
      const validatedData = await schema.parseAsync(payload);
      
      // Optionally attach validated data natively
      // req.validatedData = validatedData;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
