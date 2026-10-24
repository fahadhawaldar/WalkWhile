import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { AuthSession, AuthUser } from '@walkwhile/shared';
import { Database, Queryable } from '../db/database.js';
import { IdentityProvider, IdentityVerifier } from '../auth/identityProviders.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 90;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 401 | 409 | 501 = 401
  ) {
    super(message);
  }
}

interface UserRow {
  id: string;
  is_anonymous: boolean;
  email: string | null;
}

function toUser(row: UserRow): AuthUser {
  return { id: row.id, isAnonymous: row.is_anonymous, email: row.email };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Accounts and sessions. Every install starts with an anonymous user; linking
 * an Apple or Google login upgrades that same user, so its walks stay put.
 */
export class AuthService {
  private readonly secret: Uint8Array;

  constructor(
    private readonly db: Database,
    jwtSecret: string,
    private readonly verifiers: Partial<Record<IdentityProvider, IdentityVerifier>>
  ) {
    this.secret = new TextEncoder().encode(jwtSecret);
  }

  async createAnonymous(): Promise<AuthSession> {
    return this.db.transaction(async (tx) => {
      const { rows } = await tx.query<UserRow>(
        'INSERT INTO users DEFAULT VALUES RETURNING id, is_anonymous, email'
      );
      return this.issueSession(tx, rows[0]);
    });
  }

  /** Swaps a refresh token for a new session; the old token stops working. */
  async refresh(refreshToken: string): Promise<AuthSession> {
    return this.db.transaction(async (tx) => {
      const { rows } = await tx.query<UserRow & { token_id: string }>(
        `SELECT t.id AS token_id, u.id, u.is_anonymous, u.email
           FROM refresh_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND t.expires_at > now()
          FOR UPDATE OF t`,
        [hashToken(refreshToken)]
      );
      if (rows.length === 0) throw new AuthError('Session expired, please sign in again');
      await tx.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [
        rows[0].token_id,
      ]);
      return this.issueSession(tx, rows[0]);
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.db.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
      [hashToken(refreshToken)]
    );
  }

  /** Returns the user id for a valid access token. */
  async verifyAccessToken(token: string): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
      if (!payload.sub) throw new Error('missing subject');
      return payload.sub;
    } catch {
      throw new AuthError('Invalid or expired access token');
    }
  }

  async getUser(userId: string): Promise<AuthUser> {
    const { rows } = await this.db.query<UserRow>(
      'SELECT id, is_anonymous, email FROM users WHERE id = $1',
      [userId]
    );
    if (rows.length === 0) throw new AuthError('Account no longer exists');
    return toUser(rows[0]);
  }

  /**
   * Attaches an Apple/Google login to the signed-in user.
   *
   * - New login: the current user keeps its id and stops being anonymous.
   * - Login already belongs to another account (e.g. signing in on a second
   *   phone): this anonymous user's walks move into that account, the
   *   anonymous user is deleted, and the session switches to that account.
   */
  async linkIdentity(
    currentUserId: string,
    provider: IdentityProvider,
    idToken: string
  ): Promise<AuthSession> {
    const verifier = this.verifiers[provider];
    if (!verifier) throw new AuthError(`${provider} sign-in is not configured`, 501);

    let identity;
    try {
      identity = await verifier(idToken);
    } catch {
      throw new AuthError(`Could not verify the ${provider} sign-in`);
    }

    return this.db.transaction(async (tx) => {
      const current = (
        await tx.query<UserRow>(
          'SELECT id, is_anonymous, email FROM users WHERE id = $1 FOR UPDATE',
          [currentUserId]
        )
      ).rows[0];
      if (!current) throw new AuthError('Account no longer exists');

      const { rows: existing } = await tx.query<{ user_id: string }>(
        'SELECT user_id FROM identities WHERE provider = $1 AND subject = $2',
        [provider, identity.subject]
      );

      if (existing.length > 0 && existing[0].user_id !== current.id) {
        if (!current.is_anonymous) {
          throw new AuthError(`That ${provider} account is linked to a different user`, 409);
        }
        const ownerId = existing[0].user_id;
        await tx.query('UPDATE walks SET user_id = $1, updated_at = now() WHERE user_id = $2', [
          ownerId,
          current.id,
        ]);
        await tx.query('DELETE FROM users WHERE id = $1', [current.id]);
        const owner = (
          await tx.query<UserRow>('SELECT id, is_anonymous, email FROM users WHERE id = $1', [
            ownerId,
          ])
        ).rows[0];
        return this.issueSession(tx, owner);
      }

      if (existing.length === 0) {
        await tx.query(
          'INSERT INTO identities (user_id, provider, subject, email) VALUES ($1, $2, $3, $4)',
          [current.id, provider, identity.subject, identity.email]
        );
      }
      const { rows } = await tx.query<UserRow>(
        `UPDATE users SET is_anonymous = false, email = COALESCE(email, $2)
          WHERE id = $1 RETURNING id, is_anonymous, email`,
        [current.id, identity.email]
      );
      return this.issueSession(tx, rows[0]);
    });
  }

  private async issueSession(q: Queryable, user: UserRow): Promise<AuthSession> {
    const accessToken = await new SignJWT({ anon: user.is_anonymous })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.secret);

    const refreshToken = randomBytes(32).toString('base64url');
    await q.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(days => $3))`,
      [user.id, hashToken(refreshToken), REFRESH_TOKEN_TTL_DAYS]
    );

    return {
      user: toUser(user),
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    };
  }
}
