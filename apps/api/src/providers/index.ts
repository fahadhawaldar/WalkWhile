import { existsSync } from 'node:fs';
import { config } from '../config/env.js';
import { WalkGraph } from '../graph/walkGraph.js';
import { MockRoutingProvider } from './mockProvider.js';
import { OpenRouteServiceProvider } from './openrouteservice.js';
import { OsmGraphProvider } from './osmGraphProvider.js';
import { IRoutingProvider } from './types.js';

export * from './types.js';
export * from './openrouteservice.js';
export * from './mockProvider.js';
export * from './osmGraphProvider.js';

let defaultProviderInstance: IRoutingProvider | null = null;

export function getRoutingProvider(): IRoutingProvider {
  if (defaultProviderInstance) {
    return defaultProviderInstance;
  }

  if (config.ROUTING_PROVIDER === 'osm') {
    if (existsSync(config.GRAPH_PATH)) {
      defaultProviderInstance = new OsmGraphProvider(
        WalkGraph.load(config.GRAPH_PATH)
      );
      return defaultProviderInstance;
    }
    // Fake routes in production would send real people the wrong way.
    if (config.NODE_ENV === 'production') {
      throw new Error(`Pedestrian graph not found at ${config.GRAPH_PATH}`);
    }
    console.warn(
      `[RoutingProvider] Pedestrian graph not found at ${config.GRAPH_PATH}. Run apps/api/scripts/prepareOsm.sh to build it. Falling back to MockRoutingProvider.`
    );
  }

  if (
    config.ROUTING_PROVIDER === 'openrouteservice' &&
    config.OPENROUTESERVICE_API_KEY
  ) {
    defaultProviderInstance = new OpenRouteServiceProvider({
      apiKey: config.OPENROUTESERVICE_API_KEY,
      baseUrl: config.OPENROUTESERVICE_BASE_URL,
    });
    return defaultProviderInstance;
  }

  // Graceful fallback to mock provider if no API key is supplied
  if (config.ROUTING_PROVIDER === 'openrouteservice' && !config.OPENROUTESERVICE_API_KEY) {
    console.warn(
      '[RoutingProvider] OPENROUTESERVICE_API_KEY is not set. Falling back to MockRoutingProvider for local development/testing.'
    );
  }

  defaultProviderInstance = new MockRoutingProvider();
  return defaultProviderInstance;
}

export function setRoutingProvider(provider: IRoutingProvider): void {
  defaultProviderInstance = provider;
}
