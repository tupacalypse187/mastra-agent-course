import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const mockChargeTool = createTool({
  id: "mock-charge-tool",
  description: "Simulates a Stripe-like card charge. Always succeeds.",
  inputSchema: z.object({ amountUsd: z.number().positive() }),
  outputSchema: z.object({
    paymentIntentId: z.string(),
    amountUsd: z.number(),
    card: z.object({ brand: z.string(), last4: z.string() }),
  }),
  execute: async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      paymentIntentId: `pi_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
      amountUsd: input.amountUsd,
      card: {
        brand: ["Visa", "Mastercard", "Amex"][Math.floor(Math.random() * 3)],
        last4: String(Math.floor(1000 + Math.random() * 9000)),
      },
    };
  },
});
