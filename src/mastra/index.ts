import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { usersWorkflow } from './workflows';
import { usersAgent } from './agents';

export const mastra = new Mastra({
  workflows: { usersWorkflow },
  agents: { usersAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: {
    default: {
      enabled: true,
    },
  },
});
