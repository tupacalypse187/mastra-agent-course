import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const rideItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  land: z.string(),
  isOpen: z.boolean(),
  waitTime: z.number(),
  lastUpdatedUtc: z.string(),
});

export const getQueueTimesLiveTool = createTool({
  id: "getQueueTimesLiveTool",
  description:
    "Fetch live ride wait times for a theme park from Queue-Times. Returns rides sorted by wait time ascending.",
  inputSchema: z.object({
    parkId: z.number().int().positive().describe("Queue-Times park ID"),
    timezone: z.string().optional().describe("IANA timezone, e.g. America/New_York"),
  }),
  outputSchema: z.object({
    parkId: z.number(),
    fetchedAt: z.string(),
    items: z.array(rideItemSchema),
  }),
  execute: async ({ parkId, timezone }) => {
    const res = await fetch(
      `https://queue-times.com/en-US/parks/${parkId}/queue_times.json`,
    );
    if (!res.ok) throw new Error(`Queue-Times fetch failed: ${res.status}`);

    const data = (await res.json()) as {
      lands: Array<{
        id: number;
        name: string;
        rides: Array<{
          id: number;
          name: string;
          is_open: boolean;
          wait_time: number;
          last_updated: string;
        }>;
      }>;
    };

    const fetchedAt = timezone
      ? new Date().toLocaleString("en-US", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })
      : new Date().toISOString();

    const items = (data.lands ?? [])
      .flatMap((land) =>
        (land.rides ?? []).map((ride) => ({
          id: String(ride.id),
          name: ride.name,
          land: land.name,
          isOpen: ride.is_open,
          waitTime: ride.wait_time,
          lastUpdatedUtc: ride.last_updated,
        })),
      )
      .sort((a, b) => a.waitTime - b.waitTime);

    return { parkId, fetchedAt, items };
  },
});
