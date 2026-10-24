import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import {
  LinkIdentityRequestSchema,
  RefreshSessionRequestSchema,
  WalkRecordSchema,
} from '@walkwhile/shared';
import { AuthError, AuthService } from '../services/auth.js';
import { WalkService } from '../services/walks.js';

type AuthedRequest = Request & { userId?: string };

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, details } });
}

function handleAuthError(res: Response, err: unknown, next: NextFunction) {
  if (err instanceof AuthError) {
    const code =
      err.statusCode === 409 ? 'IDENTITY_IN_USE' : err.statusCode === 501 ? 'NOT_CONFIGURED' : 'UNAUTHORIZED';
    sendError(res, err.statusCode, code, err.message);
    return;
  }
  next(err);
}

const WalkIdSchema = z.string().uuid();

/** Account, session and walk history endpoints (mounted at /api/v1). */
export function createAccountRouter(auth: AuthService, walks: WalkService): Router {
  const router = Router();

  const requireAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      sendError(res, 401, 'UNAUTHORIZED', 'Sign-in required');
      return;
    }
    try {
      req.userId = await auth.verifyAccessToken(token);
      next();
    } catch (err) {
      handleAuthError(res, err, next);
    }
  };

  // ---- Sessions ----

  router.post('/auth/anonymous', async (_req, res, next) => {
    try {
      res.status(201).json(await auth.createAnonymous());
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/refresh', async (req, res, next) => {
    const parsed = RefreshSessionRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'refreshToken is required');
    try {
      res.json(await auth.refresh(parsed.data.refreshToken));
    } catch (err) {
      handleAuthError(res, err, next);
    }
  });

  router.post('/auth/logout', async (req, res, next) => {
    const parsed = RefreshSessionRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'refreshToken is required');
    try {
      await auth.logout(parsed.data.refreshToken);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/link', requireAuth, async (req: AuthedRequest, res, next) => {
    const parsed = LinkIdentityRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid sign-in', parsed.error.flatten());
    }
    try {
      res.json(await auth.linkIdentity(req.userId!, parsed.data.provider, parsed.data.idToken));
    } catch (err) {
      handleAuthError(res, err, next);
    }
  });

  router.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      res.json({ user: await auth.getUser(req.userId!) });
    } catch (err) {
      handleAuthError(res, err, next);
    }
  });

  // ---- Walk history ----

  router.put('/walks/:id', requireAuth, async (req: AuthedRequest, res, next) => {
    const parsed = WalkRecordSchema.safeParse({ ...req.body, id: req.params.id });
    if (!parsed.success) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid walk', parsed.error.flatten());
    }
    try {
      const saved = await walks.save(req.userId!, parsed.data);
      if (!saved) return sendError(res, 409, 'WALK_ID_TAKEN', 'That walk id belongs to another user');
      res.json({ walk: parsed.data });
    } catch (err) {
      next(err);
    }
  });

  router.get('/walks', requireAuth, async (req: AuthedRequest, res, next) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).optional(),
        before: z.string().datetime().optional(),
      })
      .safeParse(req.query);
    if (!query.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid paging parameters');
    try {
      res.json(await walks.list(req.userId!, query.data.limit, query.data.before));
    } catch (err) {
      next(err);
    }
  });

  router.get('/walks/:id', requireAuth, async (req: AuthedRequest, res, next) => {
    const id = String(req.params.id);
    if (!WalkIdSchema.safeParse(id).success) {
      return sendError(res, 404, 'NOT_FOUND', 'Walk not found');
    }
    try {
      const walk = await walks.get(req.userId!, id);
      if (!walk) return sendError(res, 404, 'NOT_FOUND', 'Walk not found');
      res.json({ walk });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/walks/:id', requireAuth, async (req: AuthedRequest, res, next) => {
    const id = String(req.params.id);
    if (!WalkIdSchema.safeParse(id).success) {
      return sendError(res, 404, 'NOT_FOUND', 'Walk not found');
    }
    try {
      const removed = await walks.remove(req.userId!, id);
      if (!removed) return sendError(res, 404, 'NOT_FOUND', 'Walk not found');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
