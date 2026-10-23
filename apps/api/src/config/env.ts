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
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const config: EnvConfig = EnvSchema.parse(process.env);
