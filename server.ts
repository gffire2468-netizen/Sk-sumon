import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './src/server/db/database';
import { apiRouter } from './src/server/routes/apiRoutes';
import { errorHandler } from './src/server/middleware/errorHandler';
import { AdminService } from './src/server/services/adminService';
import { EnvValidator } from './src/server/config/envValidator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Validate environment variables conditionally based on enabled features
  const envValidation = EnvValidator.validate();
  EnvValidator.printStartupDiagnostics(envValidation);

  if (!envValidation.isValid) {
    throw new Error(`Startup failed due to configuration errors: ${envValidation.errors.join('; ')}`);
  }

  const app = express();
  const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Body parsers
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'ALLOWALL'); // Needed for Telegram WebApp iframe
    next();
  });

  // Initialize Database & Admin User
  await db.initialize();
  await AdminService.ensureAdminUser();

  // Mount API routes
  app.use('/api', apiRouter);

  // Central error handling
  app.use(errorHandler);

  // Frontend Serving
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[Server] Production dist/ directory not found yet.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SKX Server] Running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Server Fatal]', err);
  process.exit(1);
});
