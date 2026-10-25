import {
  GenerateRoutesRequestInput,
  GenerateRoutesResponse,
  ReturnRouteRequest,
  ReturnRouteResponse,
} from '@walkwhile/shared';

// Default to local API server. In Expo, localhost works for web and simulators.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export class WalkWhileApiClient {
  private static async post<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // use default message
      }
      throw new Error(errorMessage);
    }

    return (await response.json()) as T;
  }

  /**
   * Wakes the hosted API, which sleeps when idle and takes about a minute to
   * start. Fire-and-forget: call it before the user is likely to need it.
   */
  static wake(): void {
    fetch(`${API_BASE_URL}/health`).catch(() => {});
  }

  static async generateRoutes(
    params: GenerateRoutesRequestInput
  ): Promise<GenerateRoutesResponse> {
    return this.post<GenerateRoutesResponse>('/api/v1/routes/generate', params);
  }

  static async calculateReturnRoute(
    params: ReturnRouteRequest
  ): Promise<ReturnRouteResponse> {
    return this.post<ReturnRouteResponse>('/api/v1/routes/return', params);
  }
}
