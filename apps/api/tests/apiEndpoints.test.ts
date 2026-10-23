import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server.js';

describe('Express API Endpoints', () => {
  const app = createServer();

  it('GET /health returns 200 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('walkwhile-api');
  });

  it('GET /api/v1/routes/provider returns active routing provider', async () => {
    const res = await request(app).get('/api/v1/routes/provider');
    expect(res.status).toBe(200);
    expect(res.body.provider).toBeDefined();
  });

  it('POST /api/v1/routes/generate returns 200 with valid routes', async () => {
    const res = await request(app)
      .post('/api/v1/routes/generate')
      .send({
        origin: { latitude: 25.2048, longitude: 55.2708 },
        availableMinutes: 10,
        walkingSpeedKmh: 5,
        safetyBufferMinutes: 2.5,
        maxRoutes: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.routes).toBeInstanceOf(Array);
    expect(res.body.targetDistanceMeters).toBe(625);
    expect(res.body.walkingBudgetMinutes).toBe(7.5);
    expect(res.body.disclaimer).toBeDefined();
  });

  it('POST /api/v1/routes/generate returns 400 when availableMinutes < 5', async () => {
    const res = await request(app)
      .post('/api/v1/routes/generate')
      .send({
        origin: { latitude: 25.2048, longitude: 55.2708 },
        availableMinutes: 2, // invalid: min is 5
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/routes/generate returns 400 when safetyBuffer >= availableMinutes', async () => {
    const res = await request(app)
      .post('/api/v1/routes/generate')
      .send({
        origin: { latitude: 25.2048, longitude: 55.2708 },
        availableMinutes: 10,
        safetyBufferMinutes: 10, // buffer cannot equal or exceed available time
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/routes/return returns 200 with return route and safety margin', async () => {
    const res = await request(app)
      .post('/api/v1/routes/return')
      .send({
        originalOrigin: { latitude: 25.2048, longitude: 55.2708 },
        currentLocation: { latitude: 25.2070, longitude: 55.2720 },
        remainingMinutes: 8,
      });

    expect(res.status).toBe(200);
    expect(res.body.route).toBeDefined();
    expect(res.body.safetyMarginSeconds).toBeDefined();
    expect(res.body.status).toBeDefined();
    expect(res.body.recommendedAction).toBeDefined();
  });
});
