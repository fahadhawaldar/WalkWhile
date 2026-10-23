import { config } from './config/env.js';
import { getRoutingProvider } from './providers/index.js';
import { createServer } from './server.js';

const app = createServer();
const provider = getRoutingProvider();

app.listen(config.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚶 WalkWhile API Server running on port ${config.PORT}`);
  console.log(`⚡ Environment: ${config.NODE_ENV}`);
  console.log(`🗺️  Active Routing Provider: ${provider.name}`);
  console.log(`🔗 Health Check: http://localhost:${config.PORT}/health`);
  console.log(`===============================================`);
});
