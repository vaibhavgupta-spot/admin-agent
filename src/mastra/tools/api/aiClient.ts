// no external fs helpers required for simple chat completions

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  n?: number;
  stream?: boolean;
  model?: string;
  apiVersion?: string;
}

export interface ChatCompletionResult {
  raw: any;
  assistant?: string;
}

export class AIClient {
  apiUrl: string;
  token?: string;

  /**
   * Create an AI client.
   * @param apiUrl Full URL to the chat/completions endpoint (including querystring if required). If not provided, reads process.env.AI_PROXY_URL.
   * @param token Header token to send as `token`. If not provided, reads process.env.AI_PROXY_TOKEN.
   */
  constructor(apiUrl?: string, token?: string) {
    this.apiUrl = apiUrl || process.env.AI_PROXY_URL ||
      'https://ai-services.k8s.latest0-su0.hspt.io/azure-proxy/openai/deployments/gpt-4o-mini-128k-2024-07-18/chat/completions?api-version=2024-02-15-preview';
    this.token = token || process.env.AI_PROXY_TOKEN || 'local-test';
  }

  /**
   * Create a chat completion by sending messages to the proxy endpoint.
   * Returns both the parsed assistant text (if available) and the raw payload.
   */
  async createChatCompletion(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatCompletionResult> {
    const { temperature = 0.1, n = 1, stream = false, model, apiVersion } = opts;
    

    // If user passed apiVersion, ensure it's appended to the URL query string
    let url = this.apiUrl;
    if (apiVersion && !url.includes('api-version=')) {
      url += (url.includes('?') ? '&' : '?') + `api-version=${encodeURIComponent(apiVersion)}`;
    }

    const body: any = {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      n,
      stream,
      temperature,
    };

    if (model) body.model = model;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: String(this.token ?? ''),
      },
      body: JSON.stringify(body),
    });

    const raw = await res.json().catch(async () => {
      // If response isn't JSON, return as text
      const text = await res.text();
      return { text };
    });

    // Try to extract assistant content from common shapes
    const assistant =
      raw?.choices?.[0]?.message?.content ?? raw?.choices?.[0]?.text ?? raw?.text ?? undefined;

    return { raw, assistant };
  }

  // (streaming JSON summarization removed — not used by current workflows)
}
