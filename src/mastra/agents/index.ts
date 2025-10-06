import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { usersTool } from '../tools';

export const usersAgent = new Agent({
  name: 'Users Agent',
  instructions: `
      Admin agent that can fetch and query users from the Nutella API.
`,
  model: openai('gpt-4o'),
  tools: { usersTool },
});
