import { Request, Response } from 'express';
import {
  GenerateRoutesRequestSchema,
  ReturnRouteRequestSchema,
} from '@walkwhile/shared';
import { getRoutingProvider } from '../providers/index.js';
import { generateWalkingRoutes } from '../services/routeGeneration.js';
import { calculateReturnRoute } from '../services/returnRoute.js';

export async function handleGenerateRoutes(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const parseResult = GenerateRoutesRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid route generation request parameters',
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const response = await generateWalkingRoutes(parseResult.data);
    res.status(200).json(response);
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number; details?: unknown };
    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
      error: {
        code: statusCode === 502 ? 'UPSTREAM_ROUTING_ERROR' : 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An error occurred while generating walking routes',
        details: error.details,
      },
    });
  }
}

export async function handleReturnRoute(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const parseResult = ReturnRouteRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid return route request parameters',
          details: parseResult.error.flatten(),
        },
      });
      return;
    }

    const response = await calculateReturnRoute(parseResult.data);
    res.status(200).json(response);
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number; details?: unknown };
    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
      error: {
        code: statusCode === 422 ? 'UNROUTABLE_LOCATION' : 'UPSTREAM_ROUTING_ERROR',
        message: error.message || 'An error occurred while calculating return route',
        details: error.details,
      },
    });
  }
}

export function handleGetProviderInfo(
  _req: Request,
  res: Response
): void {
  const provider = getRoutingProvider();
  res.status(200).json({
    provider: provider.name,
    timestamp: new Date().toISOString(),
  });
}
