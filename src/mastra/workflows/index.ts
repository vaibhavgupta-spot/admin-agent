import { createStep, createWorkflow } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { usersTool, aiTool } from '../tools';
import { normalizeUsersResponse } from '../tools/api/util/normalizeUsers';

// --- Users workflow: fetch users via usersTool then allow querying the returned data and asking OpenAI ---

import { userSchema, usersListSchema, User } from '../tools/api/util/normalizeUsers';

/**
 * Normalize different API response shapes into an array of `User` objects.
 * Handles: [], { users: [...] }, { data: { users: [...] } }, { items: [...] },
 * and single-user objects. It also maps common snake_case keys to camelCase.
 */
// normalizeUsersResponse moved to src/mastra/tools/api/util/normalizeUsers.ts

const fetchUsers = createStep({
  id: 'fetch-users',
  description: 'Fetches users from Nutella API using the usersTool',
  inputSchema: z.object({
    authToken: z.string().optional(),
    query: z.string().optional(),
  }),
  outputSchema: z.object({ users: usersListSchema, query: z.string().optional() }),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

    const usersRaw = await usersTool.execute({
      inputData: {
        authToken: inputData.authToken
      },
      runtimeContext: new RuntimeContext(),
    } as any);

  const normalized = normalizeUsersResponse(usersRaw);
  // Validate/parse via zod to ensure consistent user structure
  const users = usersListSchema.parse(normalized);

  return { users, query: inputData.query };
  },
});

const answerUsers = createStep({
  id: 'answer-users',
  description: 'Generate a human-readable answer using OpenAI based on the query and users report',
  inputSchema: z.object({ users: usersListSchema, query: z.string().optional() }),
  outputSchema: z.object({ answer: z.string()}),
  execute: async (context: any) => {
    const inputData = context.inputData;
    if (!inputData) throw new Error('Input data not found');

  const users = inputData.users ?? [];
  const q = inputData.query?.trim().toLowerCase();

  const usersText = JSON.stringify(users, null, 2);
  const systemContext = `User records (JSON):\n${usersText}`;
  const userQuery = inputData.query ?? '';
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'system', content: systemContext },
    { role: 'user', content: `User asked: "${userQuery}". Please provide a summary that highlights the most relevant matches, any patterns you notice, and optionally suggest next steps.` },
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
        },
      } as any);

      const answer = String(resp.assistant ?? JSON.stringify(resp.raw));
      return { answer: answer.trim() };
    } catch (err: any) {
      return { answer: `Error calling AI service: ${String(err?.message ?? err)}` };
    }
  },
});

const usersWorkflow = createWorkflow({
  id: 'users-workflow',
  inputSchema: z.object({
    authToken: z.string().optional(),
    query: z.string().optional(),
  }),
  outputSchema: z.object({ answer: z.string()}),
})
  .then(fetchUsers)
  .then(answerUsers);

usersWorkflow.commit();

export { usersWorkflow };
