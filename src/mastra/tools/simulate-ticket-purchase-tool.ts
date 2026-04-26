import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const simulateTicketPurchaseTool = createTool({
  id: 'simulate-ticket-purchase',
  description:
    'Starts a ticket purchase workflow: builds a quote, suspends for approval, then charges if approved. Returns the quote for review or the final purchase result.',
  inputSchema: z.object({
    parkName: z.string().describe('Name of the theme park'),
    date: z.string().describe('Visit date (YYYY-MM-DD)'),
    quantity: z
      .number()
      .int()
      .min(1)
      .max(12)
      .default(2)
      .describe('Number of tickets (1-12, default 2)'),
    unitPriceUsd: z
      .number()
      .positive()
      .default(110)
      .describe('Price per ticket in USD (default 110)'),
  }),
  outputSchema: z.object({
    status: z.string(),
    message: z.string(),
    quote: z
      .object({
        parkName: z.string(),
        date: z.string(),
        quantity: z.number(),
        unitPriceUsd: z.number(),
        feesUsd: z.number(),
        totalUsd: z.number(),
      })
      .optional(),
    confirmationId: z.string().optional(),
    card: z
      .object({ brand: z.string(), last4: z.string() })
      .optional(),
    visitBrief: z.string().optional(),
    runId: z.string().optional(),
  }),
  execute: async ({ parkName, date, quantity, unitPriceUsd }, { mastra }) => {
    const workflow = mastra?.getWorkflow('simulateTicketPurchaseWorkflow');
    if (!workflow) {
      throw new Error('simulateTicketPurchaseWorkflow not found');
    }

    const run = await workflow.createRun();
    const result = await run.start({
      inputData: { parkName, date, quantity, unitPriceUsd },
    });

    if (result.status === 'suspended') {
      const quote = result.steps['approve-purchase']?.output?.quote;
      const suspendedPayload =
        result.steps['approve-purchase']?.suspendPayload;
      return {
        status: 'suspended',
        message: suspendedPayload?.reason ?? 'Quote pending approval.',
        quote: quote ?? undefined,
        runId: run.runId,
      };
    }

    if (result.status === 'success') {
      return {
        status: result.result?.status ?? 'confirmed',
        message: result.result?.note ?? 'Purchase complete.',
        quote: result.result?.quote,
        confirmationId: result.result?.confirmationId,
        card: result.result?.card,
        visitBrief: result.result?.visitBrief,
        runId: run.runId,
      };
    }

    return {
      status: 'failed',
      message: result.status === 'failed' ? result.error?.message ?? 'Workflow failed.' : `Workflow ended with status: ${result.status}`,
      runId: run.runId,
    };
  },
});
