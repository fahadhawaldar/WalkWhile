import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  handleGenerateRoutes,
  handleGetProviderInfo,
  handleReturnRoute,
} from './controllers/routesController.js';
import { createAccountRouter } from './controllers/accountController.js';
import { AuthService } from './services/auth.js';
import { WalkService } from './services/walks.js';

export interface ServerOptions {
  /** Accounts and walk history; omitted when no database is available. */
  accounts?: { auth: AuthService; walks: WalkService };
}

export function createServer({ accounts }: ServerOptions = {}): Express {
  const app = express();

  // Security & utility middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'walkwhile-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Routes API v1
  app.get('/api/v1/routes/provider', handleGetProviderInfo);
  app.post('/api/v1/routes/generate', handleGenerateRoutes);
  app.post('/api/v1/routes/return', handleReturnRoute);

  if (accounts) {
    app.use('/api/v1', createAccountRouter(accounts.auth, accounts.walks));
  } else {
    app.use(['/api/v1/auth', '/api/v1/walks', '/api/v1/me'], (_req: Request, res: Response) => {
      res.status(503).json({
        error: { code: 'ACCOUNTS_UNAVAILABLE', message: 'Walk history is unavailable (no database)' },
      });
    });
  }

  // 404 catch-all
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Global error handler
  app.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[ServerError]', err);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred',
        },
      });
    }
  );

  return app;
}
