import { createStep, createWorkflow } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { usersTool } from '../tools';

// --- Users workflow: fetch users via usersTool then allow querying the returned data ---

const usersListSchema = z.array(z.unknown());

const fetchUsers = createStep({
  id: 'fetch-users',
  description: 'Fetches users from Nutella API using the usersTool',
  inputSchema: z.object({
    hsCsrfToken: z.string().optional(),
    authToken: z.string().optional(),
    query: z.string().optional(),
  }),
  outputSchema: z.object({ users: usersListSchema, query: z.string().optional() }),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

    const usersRaw = await usersTool.execute({
      inputData: {
        authToken: inputData.authToken,
        hsCsrfToken: inputData.hsCsrfToken,
      },
      runtimeContext: new RuntimeContext(),
    } as any);

    const users = Array.isArray(usersRaw) ? usersRaw : usersRaw ? [usersRaw] : [];

    return { users, query: inputData.query };
  },
});

const queryUsers = createStep({
  id: 'query-users',
  description: 'Query/filter the fetched users by a simple substring match',
  inputSchema: z.object({ users: usersListSchema, query: z.string().optional() }),
  outputSchema: z.object({ results: usersListSchema }),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

    const users = inputData.users ?? [];
    const q = inputData.query?.trim().toLowerCase();

    if (!q) {
      return { results: users };
    }

    const results = users.filter((u: any) => JSON.stringify(u).toLowerCase().includes(q));
    return { results };
  },
});

const usersWorkflow = createWorkflow({
  id: 'users-workflow',
  inputSchema: z.object({
    authToken: z.string().optional(),
    hsCsrfToken: z.string().optional(),
    query: z.string().optional(),
  }),
  outputSchema: z.object({ results: usersListSchema }),
})
  .then(fetchUsers)
  .then(queryUsers);

usersWorkflow.commit();

export { usersWorkflow };
