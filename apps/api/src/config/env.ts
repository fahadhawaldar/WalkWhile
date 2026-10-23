import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  ROUTING_PROVIDER: z
    .enum(['openrouteservice', 'mock'])
    .default('openrouteservice'),
  OPENROUTESERVICE_API_KEY: z.string().optional().default(''),
  OPENROUTESERVICE_BASE_URL: z
    .string()
    .url()
    .default('https://api.openrouteservice.org'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export const config: EnvConfig = EnvSchema.parse(process.env);
