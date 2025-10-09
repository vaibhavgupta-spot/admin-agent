import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { adminWorkflow } from './workflows';
import { adminAgent } from './agents';

export const mastra = new Mastra({
  workflows: { adminWorkflow },
  agents: { adminAgent },
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
