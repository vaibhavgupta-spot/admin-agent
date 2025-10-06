import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { NutellaClient } from './api/nutellaClient';

export const usersTool = createTool({
  id: 'get-users',
  description: 'Fetch users from Nutella API',
  inputSchema: z.object({
    cookies: z.record(z.string()).optional().describe('Cookies to send to Nutella (name->value)'),
    hsCsrfToken: z.string().optional().describe('Optional hs-csrf token'),
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
    const hsCsrfToken = ctx.hsCsrfToken;
    const authToken = ctx.authToken;

    // Use the specific API host required by Nutella/Highspot
    let client;
    const apiHost = process.env.NUTELLA_API_HOST ?? 'https://api.highspot.com/v1.0';
    if (authToken) {
      // new NutellaClient(apiHost, hsCsrfToken?, authToken?, cookies?)
      client = new NutellaClient(apiHost, hsCsrfToken, authToken, cookies ?? {});
    } else {
      client = new NutellaClient(apiHost, hsCsrfToken, undefined, cookies ?? {});
    }

    const users = await client.getUsers();
    return users;
  },
});
