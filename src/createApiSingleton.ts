import { createFetchClient } from "./createClient";
import { FetchClient, FetchClientConfig } from "./types";

let apiInstance: FetchClient | null = null;

async function initApi(config: FetchClientConfig = {}): Promise<FetchClient> {
  if (apiInstance) return apiInstance;

  apiInstance = createFetchClient(config);

  return apiInstance;
}

/**
 * Creates a proxy that lazily initializes the fetch client.
 */
function createLazyApiProxy(): FetchClient {
  return new Proxy({} as FetchClient, {
    get(_, prop: keyof FetchClient) {
      return async (...args: any[]) => {
        const client = await initApi();
        // @ts-ignore
        return client[prop](...args);
      };
    },
  });
}

export { createLazyApiProxy as createFetchClient };
