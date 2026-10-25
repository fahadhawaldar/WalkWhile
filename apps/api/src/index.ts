import { createIdentityVerifiers } from './auth/identityProviders.js';
import { config, csv, jwtSecret } from './config/env.js';
import { createPostgresDatabase, runMigrations } from './db/database.js';
import { getRoutingProvider } from './providers/index.js';
import { createServer, ServerOptions } from './server.js';
import { AuthService } from './services/auth.js';
import { WalkService } from './services/walks.js';

async function connectAccounts(): Promise<ServerOptions['accounts']> {
  const db = createPostgresDatabase(config.DATABASE_URL);
  try {
    const applied = await runMigrations(db);
    if (applied.length > 0) console.log(`🗄️  Applied migrations: ${applied.join(', ')}`);
  } catch (err) {
    // In production a missing database is a misconfiguration: fail so Cloud
    // Run reports it, rather than quietly running without accounts.
    if (config.NODE_ENV === 'production') throw err;
    // Routing still works without a database; only history is unavailable.
    console.warn(`[Database] Could not connect to ${config.DATABASE_URL}: ${(err as Error).message}`);
    await db.close();
    return undefined;
  }
  const verifiers = createIdentityVerifiers({
    appleAudience: csv(config.APPLE_AUDIENCE),
    googleClientIds: csv(config.GOOGLE_CLIENT_IDS),
  });
  return { auth: new AuthService(db, jwtSecret, verifiers), walks: new WalkService(db) };
}

const accounts = await connectAccounts();
const app = createServer({ accounts });
const provider = getRoutingProvider();

app.listen(config.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚶 WalkWhile API Server running on port ${config.PORT}`);
  console.log(`⚡ Environment: ${config.NODE_ENV}`);
  console.log(`🗺️  Active Routing Provider: ${provider.name}`);
  console.log(`🗄️  Accounts & history: ${accounts ? 'enabled' : 'disabled (no database)'}`);
  console.log(`🔗 Health Check: http://localhost:${config.PORT}/health`);
  console.log(`===============================================`);
});
