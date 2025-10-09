import { createStep, createWorkflow } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { usersTool, domainsTool, aiTool } from '../tools';
import { normalizeUsersResponse } from '../tools/api/util/normalizeUsers';

// --- Unified workflow: Route between users and domains based on query, then call AI ---

import { userSchema, usersListSchema, User } from '../tools/api/util/normalizeUsers';

const determineRoute = createStep({
  id: 'determine-route',
  description: 'Determine whether query is about users or domains',
  inputSchema: z.object({
    query: z.string(),
    authToken: z.string().optional(),
  }),
  outputSchema: z.object({
    route: z.enum(['users', 'domains']),
    query: z.string(),
    authToken: z.string().optional(),
  }),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

    const query = inputData.query.toLowerCase();
    
    // Simple keyword-based routing logic
    const userKeywords = ['user', 'users', 'account', 'accounts', 'profile', 'profiles', 'member', 'members', 'people', 'person'];
    const domainKeywords = ['domain', 'domains', 'configuration', 'config', 'setting', 'settings', 'environment', 'setup'];

    const isUserQuery = userKeywords.some(keyword => query.includes(keyword));
    const isDomainQuery = domainKeywords.some(keyword => query.includes(keyword));

    // Default to users if unclear
    const route = isDomainQuery && !isUserQuery ? 'domains' : 'users';

    return {
      route: route as 'users' | 'domains',
      query: inputData.query,
      authToken: inputData.authToken,
    };
  },
});

const fetchUsersData = createStep({
  id: 'fetch-users-data',
  description: 'Fetch users data from API and prepare for AI processing',
  inputSchema: z.object({
    route: z.enum(['users', 'domains']),
    query: z.string(),
    authToken: z.string().optional(),
  }),
  outputSchema: z.object({
    data: z.unknown(),
    dataType: z.literal('users'),
    query: z.string(),
  }),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

    const usersRaw = await usersTool.execute({
      inputData: { authToken: inputData.authToken },
      runtimeContext: new RuntimeContext(),
    } as any);

    const normalized = normalizeUsersResponse(usersRaw);
    const users = usersListSchema.parse(normalized);

    return {
      data: users,
      dataType: 'users' as const,
      query: inputData.query,
    };
  },
});

const fetchDomainsData = createStep({
  id: 'fetch-domains-data',
  description: 'Fetch domains data from API and prepare for AI processing',
  inputSchema: z.object({
    route: z.enum(['users', 'domains']),
    query: z.string(),
    authToken: z.string().optional(),
  }),
  outputSchema: z.object({
    data: z.unknown(),
    dataType: z.literal('domains'),
    query: z.string(),
  }),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

    const domainsRaw = await domainsTool.execute({
      inputData: { authToken: inputData.authToken },
      runtimeContext: new RuntimeContext(),
    } as any);

    return {
      data: domainsRaw,
      dataType: 'domains' as const,
      query: inputData.query,
    };
  },
});

const generateAnswer = createStep({
  id: 'generate-answer',
  description: 'Generate AI response based on the fetched data',
  inputSchema: z.object({
    'fetch-users-data': z.object({
      data: z.unknown(),
      dataType: z.literal('users'),
      query: z.string(),
    }),
    'fetch-domains-data': z.object({
      data: z.unknown(),
      dataType: z.literal('domains'),
      query: z.string(),
    }),
  }),
  outputSchema: z.object({
    answer: z.string(),
  }),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

    // Extract data from either branch path
    const usersData = inputData['fetch-users-data'];
    const domainsData = inputData['fetch-domains-data'];
    
    const activeData = usersData || domainsData;
    if (!activeData) throw new Error('No data found from fetch steps');
    
    const { data, dataType, query } = activeData;
    
    // Pass the required parameters: entity type, entity data, and original query
    const entityType = dataType; // 'users' or 'domains'
    const entityData = data;
    const originalQuery = query;
    
    // Create structured context with entity type, data, and query
    const systemPrompt = `You are a helpful assistant analyzing ${entityType} data. 
    
Entity Type: ${entityType}
Original Query: "${originalQuery}"

Please analyze the provided ${entityType} data and answer the user's query comprehensively.`;
    
    const dataText = JSON.stringify(entityData, null, 2);
    const dataContext = `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Data (JSON):\n${dataText}`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: dataContext },
      { role: 'user', content: originalQuery },
    ];

    try {
      const model = process.env.OPENAI_MODEL;
      const resp: any = await aiTool.execute({
        inputData: {
          apiUrl: process.env.AI_PROXY_URL,
          token: process.env.AI_PROXY_TOKEN,
          messages,
          model,
          temperature: 0.2,
          n: 1,
          // Pass the structured parameters explicitly
          entityType,
          entityData,
          originalQuery,
        },
      } as any);

      const answer = String(resp.assistant ?? JSON.stringify(resp.raw));
      return { answer: answer.trim() };
    } catch (err: any) {
      return { answer: `Error calling AI service: ${String(err?.message ?? err)}` };
    }
  },
});

// Use conditional routing step that delegates to appropriate fetch step
const routeAndFetch = createStep({
  id: 'route-and-fetch',
  description: 'Route to appropriate data fetching step based on route',
  inputSchema: z.object({
    route: z.enum(['users', 'domains']),
    query: z.string(),
    authToken: z.string().optional(),
  }),
  outputSchema: z.object({
    data: z.unknown(),
    dataType: z.enum(['users', 'domains']),
    query: z.string(),
  }),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

    const { route } = inputData;
    
    // Route to appropriate fetch step
    if (route === 'users') {
      return await fetchUsersData.execute(context);
    } else {
      return await fetchDomainsData.execute(context);
    }
  },
});

// Single unified workflow using proper step routing
const adminWorkflow = createWorkflow({
  id: 'admin-workflow',
  inputSchema: z.object({
    query: z.string(),
    authToken: z.string().optional(),
  }),
  outputSchema: z.object({
    answer: z.string(),
  }),
})
  .then(determineRoute)
  .branch([
    [async ({ inputData: { route } }) => route === 'users', fetchUsersData],
    [async ({ inputData: { route } }) => route !== 'users', fetchDomainsData]
  ])
  .then(generateAnswer);

adminWorkflow.commit();

export { adminWorkflow };
