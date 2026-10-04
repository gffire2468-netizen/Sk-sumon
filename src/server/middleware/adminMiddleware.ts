import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ConfigService } from '../config/configService';

export interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    username: string;
    role: string;
  };
}

export function adminAuthMiddleware(
  req: AdminRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or malformed Authorization header',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ConfigService.getJwtSecret()) as any;

    req.adminUser = {
      id: decoded.sub,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired admin session token',
    });
  }
}
