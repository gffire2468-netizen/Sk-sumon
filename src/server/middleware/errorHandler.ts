import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || 500;
  const message = err.message || 'An unexpected internal error occurred';

  // Production safety: never leak stack traces or internal secrets
  console.error('[API Error]', {
    status,
    message,
    timestamp: new Date().toISOString(),
  });

  res.status(status).json({
    success: false,
    error: message,
  });
}
