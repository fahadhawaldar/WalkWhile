import { createRemoteJWKSet, jwtVerify } from 'jose';

export type IdentityProvider = 'apple' | 'google';

export interface VerifiedIdentity {
  /** The provider's stable id for this person. */
  subject: string;
  email: string | null;
}

/** Checks a sign-in identity token; throws if it is invalid. */
export type IdentityVerifier = (idToken: string) => Promise<VerifiedIdentity>;

const APPLE_KEYS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

async function verify(
  idToken: string,
  keys: typeof APPLE_KEYS,
  issuer: string | string[],
  audience: string[]
): Promise<VerifiedIdentity> {
  const { payload } = await jwtVerify(idToken, keys, { issuer, audience });
  if (!payload.sub) throw new Error('Identity token has no subject');
  const email = typeof payload.email === 'string' ? payload.email : null;
  return { subject: payload.sub, email };
}

/**
 * Builds verifiers for the providers that are configured. Apple's audience
 * is the app's bundle id; Google's are the OAuth client ids.
 */
export function createIdentityVerifiers(config: {
  appleAudience: string[];
  googleClientIds: string[];
}): Partial<Record<IdentityProvider, IdentityVerifier>> {
  const verifiers: Partial<Record<IdentityProvider, IdentityVerifier>> = {};
  if (config.appleAudience.length > 0) {
    verifiers.apple = (token) =>
      verify(token, APPLE_KEYS, 'https://appleid.apple.com', config.appleAudience);
  }
  if (config.googleClientIds.length > 0) {
    verifiers.google = (token) =>
      verify(
        token,
        GOOGLE_KEYS,
        ['https://accounts.google.com', 'accounts.google.com'],
        config.googleClientIds
      );
  }
  return verifiers;
}
