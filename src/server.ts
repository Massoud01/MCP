import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createEvent } from "./createEvent.js";
import { checkUserAvailability } from "./availability.js";
import { z } from "zod";

const server = new McpServer({
  name: "mcp-streamable-http",
  version: "1.0.0",
});


const getUserAvailabilityGraph = server.tool(
  "get-user-availability-graph",
  "Get calendar availability for a user using Microsoft Graph (app-only)",
  {
    email: z.string().describe("The email of the user to check availability for"),
    date: z.string().describe("Date to check availability on (YYYY-MM-DD)"),
    startTime: z.string().describe("Start time (HH:mm)"),
    endTime: z.string().describe("End time (HH:mm)"),
  },
  async ({ email, date, startTime, endTime }) => {
    try {
      // Combine date and times into ISO strings in UTC
      const start = new Date(`${date}T${startTime}:00Z`).toISOString();
      const end = new Date(`${date}T${endTime}:00Z`).toISOString();

      const data = await checkUserAvailability(email, start, end);

      const availability = data.value?.[0]?.availabilityView;
      if (!availability) {
        return {
          content: [{ type: "text", text: `⚠️ No availability data returned for ${email}.` }],
        };
      }

      const slots = availability.split("").map((code: string, index: number) => {
        const slotHour = parseInt(startTime.split(":")[0]) + Math.floor(index / 2);
        const slotMin = index % 2 === 0 ? "00" : "30";
        const time = `${slotHour.toString().padStart(2, "0")}:${slotMin}`;
        const status =
          code === "0" ? "✅ Available" :
          code === "1" ? "🟡 Tentative" :
          code === "2" ? "❌ Busy" :
          code === "3" ? "🔒 OOF" :
          "❓ Unknown";
        return `• ${time}: ${status}`;
      });

      const responseText = `📅 Availability for **${email}** on ${date}:\n\n${slots.join("\n")}`;

      return {
        content: [{ type: "text", text: responseText }],
      };
    } catch (error: any) {
      console.error(`Error fetching availability for ${email}:`, error);
      return {
        content: [
          {
            type: "text",
            text: `❌ Error fetching availability for ${email}: ${error.message}`,
          },
        ],
      };
    }
  }
);

const createCalendarEvent = server.tool(
  "create-calendar-event",
  "Create a calendar event for a user",
  {
    email: z.string().email().describe("Email address of the user"),
    subject: z.string().min(1).describe("Subject of the event"),
    content: z.string().optional().describe("Event body content"),
    startDateTime: z.string().min(1).describe("Event start date/time in ISO format, e.g. 2025-07-20T14:00:00"),
    endDateTime: z.string().min(1).describe("Event end date/time in ISO format"),
    timeZone: z.string().optional().default("UTC").describe("Time zone of the event, e.g. UTC, Pacific Standard Time"),
  },
  async (params: {
    email: string;
    subject: string;
    content?: string;
    startDateTime: string;
    endDateTime: string;
    timeZone?: string;
  }) => {
    try {
      const event = await createEvent(params.email, {
        subject: params.subject,
        content: params.content || "",
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime,
        timeZone: params.timeZone,
      });

      return {
        content: [
          {
            type: "text",
            text: `✅ Event created successfully for ${params.email} with subject "${params.subject}".`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to create event: ${error.message}`,
          },
        ],
      };
    }
  }
);

const app = express();
app.use(express.json());

const transport: StreamableHTTPServerTransport =
  new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // set to undefined for stateless servers
  });

// Setup routes for the server
const setupServer = async () => {
  await server.connect(transport);
};

app.post("/mcp", async (req: Request, res: Response) => {
  console.log("Received MCP request:", req.body);
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  console.log("Received GET MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

app.delete("/mcp", async (req: Request, res: Response) => {
  console.log("Received DELETE MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

// Start the server
const PORT = process.env.PORT || 3000;
setupServer()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to set up the server:", error);
    process.exit(1);
  });
