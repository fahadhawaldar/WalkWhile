import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Express } from 'express';
import { AuthSession, WalkRecord } from '@walkwhile/shared';
import { Database, runMigrations } from '../src/db/database.js';
import { createServer } from '../src/server.js';
import { AuthService } from '../src/services/auth.js';
import { WalkService } from '../src/services/walks.js';

/** Real Postgres (in-process) behind the same interface the server uses. */
function pgliteDatabase(pg: PGlite): Database {
  const run = (q: Pick<PGlite, 'query' | 'exec'>) => async (text: string, params?: unknown[]) => {
    // Migrations hold several statements, which only exec accepts.
    if (!params || params.length === 0) {
      const results = await q.exec(text);
      return { rows: (results[results.length - 1]?.rows ?? []) as never[] };
    }
    return { rows: (await q.query(text, params)).rows as never[] };
  };
  return {
    query: run(pg),
    transaction: (fn) => pg.transaction((tx) => fn({ query: run(tx) })),
    close: () => pg.close(),
  };
}

// Stub sign-in: the token text is "<subject>|<email>".
const fakeVerifier = async (idToken: string) => {
  const [subject, email] = idToken.split('|');
  if (!subject) throw new Error('bad token');
  return { subject, email: email ?? null };
};

function walk(overrides: Partial<WalkRecord> = {}): WalkRecord {
  return {
    id: randomUUID(),
    startedAt: '2026-10-24T10:00:00.000Z',
    endedAt: '2026-10-24T10:15:00.000Z',
    outcome: 'completed',
    waitType: 'fixed',
    plannedMinutes: 15,
    durationSeconds: 900,
    distanceMeters: 1100,
    steps: 1450,
    returnedOnTime: true,
    origin: { latitude: 25.0784, longitude: 55.1394 },
    routeCoordinates: [
      [55.1394, 25.0784],
      [55.14, 25.079],
    ],
    ...overrides,
  };
}

describe('Accounts and walk history', () => {
  let db: Database;
  let app: Express;

  beforeEach(async () => {
    db = pgliteDatabase(new PGlite());
    await runMigrations(db);
    const auth = new AuthService(db, 'test-secret-that-is-at-least-32-chars', {
      apple: fakeVerifier,
    });
    app = createServer({ accounts: { auth, walks: new WalkService(db) } });
  });

  afterEach(async () => {
    await db.close();
  });

  const anonymous = async (): Promise<AuthSession> =>
    (await request(app).post('/api/v1/auth/anonymous').expect(201)).body;

  const save = (session: AuthSession, w: WalkRecord) =>
    request(app)
      .put(`/api/v1/walks/${w.id}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send(w);

  const list = async (session: AuthSession) =>
    (
      await request(app)
        .get('/api/v1/walks')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200)
    ).body.walks as WalkRecord[];

  const link = (session: AuthSession, idToken: string) =>
    request(app)
      .post('/api/v1/auth/link')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ provider: 'apple', idToken });

  it('creates an anonymous account with a session', async () => {
    const session = await anonymous();
    expect(session.user.isAnonymous).toBe(true);
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
  });

  it('rejects walk requests without a valid token', async () => {
    await request(app).get('/api/v1/walks').expect(401);
    await request(app).get('/api/v1/walks').set('Authorization', 'Bearer nope').expect(401);
  });

  it('saves, lists newest first, fetches and deletes walks', async () => {
    const session = await anonymous();
    const older = walk({ startedAt: '2026-10-20T08:00:00.000Z', endedAt: '2026-10-20T08:10:00.000Z' });
    const newer = walk();
    await save(session, older).expect(200);
    await save(session, newer).expect(200);

    const walks = await list(session);
    expect(walks.map((w) => w.id)).toEqual([newer.id, older.id]);
    expect(walks[0]).toEqual(newer);

    await request(app)
      .delete(`/api/v1/walks/${older.id}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(204);
    expect((await list(session)).map((w) => w.id)).toEqual([newer.id]);
  });

  it('treats a retried save as an update, not a duplicate', async () => {
    const session = await anonymous();
    const w = walk();
    await save(session, w).expect(200);
    await save(session, { ...w, steps: 1500 }).expect(200);
    const walks = await list(session);
    expect(walks).toHaveLength(1);
    expect(walks[0].steps).toBe(1500);
  });

  it("never lets a user read or overwrite someone else's walk", async () => {
    const alice = await anonymous();
    const bob = await anonymous();
    const w = walk();
    await save(alice, w).expect(200);

    await save(bob, { ...w, steps: 1 }).expect(409);
    await request(app)
      .get(`/api/v1/walks/${w.id}`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(404);
    expect(await list(bob)).toEqual([]);
    expect((await list(alice))[0].steps).toBe(w.steps);
  });

  it('pages through walks with a cursor', async () => {
    const session = await anonymous();
    for (let day = 1; day <= 5; day++) {
      const startedAt = `2026-10-0${day}T09:00:00.000Z`;
      await save(session, walk({ startedAt, endedAt: startedAt })).expect(200);
    }
    const first = await request(app)
      .get('/api/v1/walks?limit=2')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(first.body.walks).toHaveLength(2);
    const second = await request(app)
      .get(`/api/v1/walks?limit=10&before=${first.body.nextCursor}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(second.body.walks).toHaveLength(3);
    expect(second.body.nextCursor).toBeNull();
  });

  it('rotates refresh tokens so each one works only once', async () => {
    const session = await anonymous();
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    expect(refreshed.body.user.id).toBe(session.user.id);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('logging in keeps the same user id, so walks stay linked', async () => {
    const session = await anonymous();
    const w = walk();
    await save(session, w).expect(200);

    const linked = (await link(session, 'apple-user-1|me@example.com').expect(200)).body as AuthSession;
    expect(linked.user).toEqual({ id: session.user.id, isAnonymous: false, email: 'me@example.com' });
    expect((await list(linked)).map((x) => x.id)).toEqual([w.id]);
  });

  it('signing in on a new phone moves its walks into the existing account', async () => {
    const firstPhone = await anonymous();
    const oldWalk = walk({ startedAt: '2026-10-01T09:00:00.000Z' });
    await save(firstPhone, oldWalk).expect(200);
    const account = (await link(firstPhone, 'apple-user-1').expect(200)).body as AuthSession;

    const secondPhone = await anonymous();
    const newWalk = walk();
    await save(secondPhone, newWalk).expect(200);

    const merged = (await link(secondPhone, 'apple-user-1').expect(200)).body as AuthSession;
    expect(merged.user.id).toBe(account.user.id);
    expect((await list(merged)).map((x) => x.id)).toEqual([newWalk.id, oldWalk.id]);

    // The second phone's anonymous account is gone.
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: secondPhone.refreshToken })
      .expect(401);
  });

  it("refuses to attach a login that belongs to another real account", async () => {
    const alice = (await link(await anonymous(), 'apple-alice').expect(200)).body as AuthSession;
    await link(await anonymous(), 'apple-bob').expect(200);
    const res = await link(alice, 'apple-bob').expect(409);
    expect(res.body.error.code).toBe('IDENTITY_IN_USE');
  });

  it('reports unconfigured sign-in providers', async () => {
    const session = await anonymous();
    await request(app)
      .post('/api/v1/auth/link')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ provider: 'google', idToken: 'x' })
      .expect(501);
  });
});
