import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { usersTool, domainsTool, aiTool } from '../tools';

export const adminAgent = new Agent({
  name: 'Admin Agent',
  instructions: `
      Agent that can fetch data and solve queries using Nutella API & Playbooks.
`,
  model: openai('gpt-4o'),
  tools: { usersTool, domainsTool, aiTool },
});
