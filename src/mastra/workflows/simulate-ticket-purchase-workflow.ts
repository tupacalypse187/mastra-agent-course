import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { mockChargeTool } from '../tools/mock-charge-tool';

const quoteSchema = z.object({
  parkName: z.string(),
  date: z.string(),
  quantity: z.number().int().min(1).max(12),
  unitPriceUsd: z.number().positive(),
  feesUsd: z.number().nonnegative(),
  totalUsd: z.number().positive(),
});

const resultSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
  note: z.string(),
  quote: quoteSchema,
  confirmationId: z.string().optional(),
  card: z
    .object({
      brand: z.string(),
      last4: z.string(),
    })
    .optional(),
  visitBrief: z.string().optional(),
});

const buildQuote = createStep({
  id: 'build-quote',
  description: 'Calculates the ticket quote including fees',
  inputSchema: z.object({
    date: z.string(),
    quantity: z.number().int().min(1).max(12).default(2),
    unitPriceUsd: z.number().positive().default(110),
  }),
  outputSchema: z.object({
    parkName: z.string(),
    date: z.string(),
    quantity: z.number().int().min(1).max(12),
    unitPriceUsd: z.number().positive(),
    feesUsd: z.number().nonnegative(),
    totalUsd: z.number().positive(),
  }),
  execute: async ({ inputData, getInitData }) => {
    const init = getInitData();
    const parkName = (init as { parkName?: string }).parkName ?? 'Theme Park';
    const { date, quantity, unitPriceUsd } = inputData;
    const subtotal = unitPriceUsd * quantity;
    const feesUsd = Math.max(0, subtotal * 0.065);
    return {
      parkName,
      date,
      quantity,
      unitPriceUsd,
      feesUsd: Math.round(feesUsd * 100) / 100,
      totalUsd: Math.round((subtotal + feesUsd) * 100) / 100,
    };
  },
});

const approvePurchase = createStep({
  id: 'approve-purchase',
  description: 'Suspends workflow for human approval of the quote',
  inputSchema: quoteSchema,
  outputSchema: resultSchema,
  resumeSchema: z.object({
    approved: z.boolean(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    const quote = inputData;

    if (resumeData?.approved === false) {
      return bail({
        status: 'cancelled' as const,
        note: 'Purchase cancelled by user.',
        quote,
      });
    }

    if (!resumeData?.approved) {
      return await suspend({
        reason: `Quote ready for review: ${quote.quantity} ticket(s) for ${quote.parkName} on ${quote.date} — $${quote.totalUsd.toFixed(2)} total. Approve to proceed with charge.`,
      });
    }

    return {
      status: 'confirmed' as const,
      note: 'Purchase approved.',
      quote,
    };
  },
});

const chargeCard = createStep({
  id: 'charge-card',
  description: 'Charges the card for the approved purchase',
  inputSchema: resultSchema,
  outputSchema: resultSchema,
  execute: async ({ inputData, mastra }) => {
    const { quote, status } = inputData;

    if (status !== 'confirmed') {
      return inputData;
    }

    if (!mockChargeTool.execute) {
      throw new Error('mockChargeTool.execute is not defined');
    }

    const chargeResult = await mockChargeTool.execute(
      { amountUsd: quote.totalUsd },
      { mastra },
    );

    if (!chargeResult || !('paymentIntentId' in chargeResult)) {
      throw new Error('Card charge failed');
    }

    return {
      ...inputData,
      status: 'confirmed' as const,
      note: `Charged $${quote.totalUsd.toFixed(2)} to ${chargeResult.card.brand} ending in ${chargeResult.card.last4}.`,
      confirmationId: chargeResult.paymentIntentId,
      card: {
        brand: chargeResult.card.brand,
        last4: chargeResult.card.last4,
      },
    };
  },
});

const postPurchaseSummary = createStep({
  id: 'post-purchase-summary',
  description:
    'After a confirmed purchase, asks the theme park agent for a concise visit brief with arrival tips, must-do attractions, and things to avoid.',
  inputSchema: resultSchema,
  outputSchema: resultSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const { quote, status, confirmationId, card } = inputData;

    if (status !== 'confirmed' || !confirmationId || !card) {
      return inputData;
    }

    console.log(
      `\n✅ Confirmation: ${confirmationId}`,
      `\n💳 Charged $${quote.totalUsd.toFixed(2)} to ${card.brand} ending in ${card.last4}`,
      `\n🎫 ${quote.quantity} ticket(s) for ${quote.parkName} on ${quote.date}`,
    );

    const agent = mastra?.getAgent('themeParkAgent');
    if (!agent) {
      return inputData;
    }

    console.log(
      `\n🎫 Purchase confirmed! Generating your visit brief for ${quote.parkName} on ${quote.date}...\n`,
    );

    const prompt = [
      `A user just booked ${quote.quantity} ticket(s) to ${quote.parkName} for ${quote.date}.`,
      `Total: $${quote.totalUsd.toFixed(2)} (${quote.quantity} × $${quote.unitPriceUsd.toFixed(2)} + $${quote.feesUsd.toFixed(2)} fees).`,
      `Confirmation ID: ${confirmationId}. Card: ${card.brand} ending in ${card.last4}.`,
      '',
      'Use your tools to check crowd forecast and historical busy-day data for that date, then provide a concise 3-point visit brief:',
      '1. Best arrival time and why.',
      '2. One must-do attraction in the first 30 minutes.',
      '3. One specific thing to avoid or watch out for.',
    ].join('\n');

    const stream = await agent.stream(prompt, { maxSteps: 5 });

    const briefText = await stream.text ?? '';

    if (briefText) {
      console.log(`\n${briefText}\n`);
    }

    return {
      ...inputData,
      visitBrief: briefText,
    };
  },
});

const simulateTicketPurchaseWorkflow = createWorkflow({
  id: 'simulate-ticket-purchase-workflow',
  inputSchema: z.object({
    parkName: z.string().optional().default('Theme Park'),
    date: z.string(),
    quantity: z.number().int().min(1).max(12).default(2),
    unitPriceUsd: z.number().positive().default(110),
  }),
  outputSchema: resultSchema,
})
  .then(buildQuote)
  .then(approvePurchase)
  .then(chargeCard)
  .then(postPurchaseSummary)
  .commit();

export { simulateTicketPurchaseWorkflow, quoteSchema, resultSchema };
