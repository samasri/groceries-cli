const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (status: number) => status >= 500 && status < 600;

const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  attempt = 1,
): Promise<Response> => {
  const response = await fetch(url, options);

  if (!isRetryable(response.status) || attempt >= MAX_RETRIES) {
    return response;
  }

  await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
  return fetchWithRetry(url, options, attempt + 1);
};

export const httpGet = (url: string, headers: Record<string, string> = {}): Promise<Response> =>
  fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'nofrills-cli/1.0',
      ...headers,
    },
  });
