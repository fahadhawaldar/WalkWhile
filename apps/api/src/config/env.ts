import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEFAULT_GRAPH_PATH = fileURLToPath(
  new URL('../../../../data/graphs/dubai.graph', import.meta.url)
);

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  ROUTING_PROVIDER: z
    .enum(['osm', 'openrouteservice', 'mock'])
    .default('osm'),
  GRAPH_PATH: z.string().default(DEFAULT_GRAPH_PATH),
  OPENROUTESERVICE_API_KEY: z.string().optional().default(''),
  OPENROUTESERVICE_BASE_URL: z
    .string()
    .url()
    .default('https://api.openrouteservice.org'),
  DATABASE_URL: z.string().default('postgres://localhost/walkwhile'),
  /** Signs access tokens. Must be set (32+ random characters) in production. */
  JWT_SECRET: z.string().min(32).optional(),
  /** Sign in with Apple audiences: the iOS bundle id(s), comma separated. */
  APPLE_AUDIENCE: z.string().default('com.fahadhdev.walkwhile'),
  /** Google OAuth client ids, comma separated. Empty disables Google sign-in. */
  GOOGLE_CLIENT_IDS: z.string().default(''),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const config: EnvConfig = EnvSchema.parse(process.env);

if (!config.JWT_SECRET && config.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}

/** Development-only fallback so the API runs without setup. Never used in production. */
export const jwtSecret = config.JWT_SECRET ?? 'walkwhile-development-secret-do-not-use-in-prod';

export function csv(value: string): string[] {
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}
