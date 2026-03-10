import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { mockChargeTool } from "../tools/mock-charge-tool";

const inputSchema = z.object({
  parkName: z.string().min(2),
  date: z.string().min(4),
  quantity: z.number().int().min(1).max(12).default(2),
  unitPriceUsd: z.number().positive().default(110),
});

const quoteSchema = z.object({
  parkName: z.string(),
  date: z.string(),
  quantity: z.number(),
  unitPriceUsd: z.number(),
  feesUsd: z.number(),
  totalUsd: z.number(),
});

const approvalSchema = z.object({
  approved: z.boolean(),
  quote: quoteSchema,
});

const resultSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]),
  note: z.string(),
  quote: quoteSchema,
  confirmationId: z.string().optional(),
  card: z.object({ brand: z.string(), last4: z.string() }).optional(),
});

const buildQuote = createStep({
  id: "build-quote",
  inputSchema,
  outputSchema: quoteSchema,
  execute: async ({ inputData }) => {
    const { unitPriceUsd, ...rest } = inputData;
    const feesUsd = Math.max(
      5,
      Math.round(unitPriceUsd * rest.quantity * 0.06),
    );
    return {
      ...rest,
      unitPriceUsd,
      feesUsd,
      totalUsd: unitPriceUsd * rest.quantity + feesUsd,
    };
  },
});

const approvePurchase = createStep({
  id: "approve-purchase",
  inputSchema: quoteSchema,
  suspendSchema: z.object({ message: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  outputSchema: approvalSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        message: `Simulate purchase for "${inputData.parkName}" on ${inputData.date} ($${inputData.totalUsd}). Approve?`,
      });
    }
    return { approved: resumeData.approved, quote: inputData };
  },
});

const chargeCard = createStep({
  id: "charge-card",
  inputSchema: approvalSchema,
  outputSchema: resultSchema,
  execute: async ({ inputData }) => {
    if (!inputData.approved) {
      return {
        status: "cancelled" as const,
        note: "Cancelled.",
        quote: inputData.quote,
      };
    }

    const charge = await mockChargeTool.execute!(
      { amountUsd: inputData.quote.totalUsd },
      {},
    );

    if ("error" in charge) {
      return {
        status: "cancelled" as const,
        note: "Payment failed.",
        quote: inputData.quote,
      };
    }

    return {
      status: "confirmed" as const,
      confirmationId: charge.paymentIntentId,
      card: charge.card,
      note: "Simulated charge complete. No money was charged.",
      quote: inputData.quote,
    };
  },
});

export const simulateTicketPurchaseWorkflow = createWorkflow({
  id: "simulate-ticket-purchase-workflow",
  inputSchema,
  outputSchema: resultSchema,
})
  .then(buildQuote)
  .then(approvePurchase)
  .then(chargeCard)
  .commit();
