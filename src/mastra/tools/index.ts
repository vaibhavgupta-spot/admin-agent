import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { NutellaClient } from './api/nutellaClient';
import { AIClient, ChatMessage } from './api/aiClient';
import { readFile as readFileAsync } from 'fs/promises';

export const usersTool = createTool({
  id: 'get-users',
  description: 'Fetch users from Nutella API',
  inputSchema: z.object({
    cookies: z.record(z.string()).optional().describe('Cookies to send to Nutella (name->value)'),
    authToken: z.string().optional().describe('Optional Basic auth token to use in Authorization header')
  }),
  outputSchema: z.unknown(),
  execute: async (params: any) => {
    // Support multiple invocation shapes:
    // - execute({ context: { ... } })
    // - execute({ inputData: { ... }, runtimeContext })
    // - execute(inputData)
    const ctx = params?.context ?? params?.inputData ?? params ?? {};
    const cookies = ctx.cookies ?? {};
    const authToken = ctx.authToken;

    // Use the specific API host required by Nutella/Highspot
    let client;
    const apiHost = process.env.NUTELLA_API_HOST ?? 'https://api.highspot.com/v1.0';
    if (authToken) {
      // NutellaClient(apiHost, authToken?, cookies?)
      client = new NutellaClient(apiHost, authToken, cookies ?? {});
    } else {
      client = new NutellaClient(apiHost, undefined, cookies ?? {});
    }

    const users = await client.getUsers();
    return users;
  },
});

export const domainsTool = createTool({
  id: 'get-domains',
  description: 'Fetch domain configuration from Nutella API',
  inputSchema: z.object({
    cookies: z.record(z.string()).optional().describe('Cookies to send to Nutella (name->value)'),
    authToken: z.string().optional().describe('Optional Basic auth token to use in Authorization header')
  }),
  outputSchema: z.unknown(),
  execute: async (params: any) => {
    // Support multiple invocation shapes:
    // - execute({ context: { ... } })
    // - execute({ inputData: { ... }, runtimeContext })
    // - execute(inputData)
    const ctx = params?.context ?? params?.inputData ?? params ?? {};
    const cookies = ctx.cookies ?? {};
    const authToken = ctx.authToken;

    // Use the specific API host required by Nutella/Highspot
    let client;
    const apiHost = process.env.NUTELLA_API_HOST ?? 'https://api.highspot.com/v1.0';
    if (authToken) {
      // NutellaClient(apiHost, authToken?, cookies?)
      client = new NutellaClient(apiHost, authToken, cookies ?? {});
    } else {
      client = new NutellaClient(apiHost, undefined, cookies ?? {});
    }

    // For domains, we'll use a hypothetical domains endpoint
    // This would need to be implemented in NutellaClient if it doesn't exist
    const domains = await client.getDomains();
    return domains;
  },
});

export const aiTool = createTool({
  id: 'ai-tool',
  description: 'Call configured AI proxy/OpenAI with optional JSON context and entity information',
  inputSchema: z.object({
    apiUrl: z.string().optional().describe('Optional proxied API url; falls back to env AI_PROXY_URL'),
    token: z.string().optional().describe('Optional proxy token; falls back to env AI_PROXY_TOKEN'),
    prompt: z.string().optional().describe('User prompt to send to the assistant'),
    messages: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
    jsonFilePath: z.string().optional().describe('Optional path to a JSON file to include as system context'),
    jsonContent: z.string().optional().describe('Optional raw JSON content to include as system context'),
    model: z.string().optional(),
    temperature: z.number().optional(),
    n: z.number().optional(),
    // Additional fields for entity-specific processing
    entityType: z.enum(['users', 'domains']).optional().describe('Type of entity being processed'),
    entityData: z.unknown().optional().describe('Entity data being analyzed'),
    originalQuery: z.string().optional().describe('Original user query'),
  }),
  outputSchema: z.unknown(),
  execute: async (params: any) => {
    const ctx = params?.context ?? params?.inputData ?? params ?? {};
    const apiUrl = ctx.apiUrl ?? process.env.AI_PROXY_URL;
    const token = ctx.token ?? process.env.AI_PROXY_TOKEN;
    const model = ctx.model ?? process.env.OPENAI_MODEL;
    const temperature = ctx.temperature ?? 0.2;
    const n = ctx.n ?? 1;

    // Extract entity-specific parameters
    const entityType = ctx.entityType;
    const entityData = ctx.entityData;
    const originalQuery = ctx.originalQuery;

    // Build messages: if caller provided explicit messages, use them; otherwise use prompt
    let messages: ChatMessage[] = [];
    if (Array.isArray(ctx.messages)) {
      messages = ctx.messages as ChatMessage[];
    } else {
      const prompt = String(ctx.prompt ?? '');
      if (prompt) messages = [{ role: 'user', content: prompt }];
    }

    // If JSON file path provided, read file and insert as system context
    if (ctx.jsonFilePath) {
      try {
        const file = String(ctx.jsonFilePath);
        const content = await readFileAsync(file, { encoding: 'utf8' });
        messages = [{ role: 'system', content: `Context (JSON):\n${content}` }, ...messages];
      } catch (err: any) {
        throw new Error(`Failed to read jsonFilePath ${String(ctx.jsonFilePath)}: ${String(err?.message ?? err)}`);
      }
    } else if (ctx.jsonContent) {
      messages = [{ role: 'system', content: `Context (JSON):\n${String(ctx.jsonContent)}` }, ...messages];
    }

    // Log entity information for debugging/monitoring if provided
    if (entityType && entityData && originalQuery) {
      console.log(`AI Tool called with entity type: ${entityType}, query: "${originalQuery}"`);
    }

    const client = new AIClient(apiUrl, token);
    const resp = await client.createChatCompletion(messages, { temperature, n, model });
    return resp;
  },
});
