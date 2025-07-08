import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { findAvailability } from "./findAvailability.js";
import { createEvent } from "./createEvent.js";
import { checkUserAvailability } from "./availability.js";
import { z } from "zod";

const server = new McpServer({
  name: "mcp-streamable-http",
  version: "1.0.0",
});

// // Get Chuck Norris joke tool
// const getChuckJoke = server.tool(
//   "get-chuck-joke",
//   "Get a random Chuck Norris joke",
//   async () => {
//     const response = await fetch("https://api.chucknorris.io/jokes/random");
//     const data = await response.json();
//     return {
//       content: [
//         {
//           type: "text",
//           text: data.value,
//         },
//       ],
//     };
//   }
// );

// // Get Chuck Norris joke by category tool
// const getChuckJokeByCategory = server.tool(
//   "get-chuck-joke-by-category",
//   "Get a random Chuck Norris joke by category",
//   {
//     category: z.string().describe("Category of the Chuck Norris joke"),
//   },
//   async (params: { category: string }) => {
//     const response = await fetch(
//       `https://api.chucknorris.io/jokes/random?category=${params.category}`
//     );
//     const data = await response.json();
//     return {
//       content: [
//         {
//           type: "text",
//           text: data.value,
//         },
//       ],
//     };
//   }
// );

// // Get Chuck Norris joke categories tool
// const getChuckCategories = server.tool(
//   "get-chuck-categories",
//   "Get all available categories for Chuck Norris jokes",
//   async () => {
//     const response = await fetch("https://api.chucknorris.io/jokes/categories");
//     const data = await response.json();
//     return {
//       content: [
//         {
//           type: "text",
//           text: data.join(", "),
//         },
//       ],
//     };
//   }
// );

// // Get Dad joke tool
// const getDadJoke = server.tool(
//   "get-dad-joke",
//   "Get a random dad joke",
//   async () => {
//     const response = await fetch("https://icanhazdadjoke.com/", {
//       headers: {
//         Accept: "application/json",
//       },
//     });
//     const data = await response.json();
//     return {
//       content: [
//         {
//           type: "text",
//           text: data.joke,
//         },
//       ],
//     };
//   }
// );
const getUserAvailabilityGraph = server.tool(
  "get-user-availability-graph",
  "Get calendar availability for a user using Microsoft Graph (app-only)",
  {
    email: z.string().describe("The email address of the user to check availability for"),
  },
  async ({ email }: { email: string }) => {
    try {
      const data = await checkUserAvailability(email);

      const availability = data.value?.[0]?.availabilityView;
      const responseText = availability
        ? `📅 Availability for ${email}: ${availability}`
        : `⚠️ No availability data returned for ${email}.`;

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
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

const getUserAvailability = server.tool(
  "get-user-availability",
  "Get calendar availability for a user (delegated)",
  {
    email: z.string().describe("The email address of the user to check availability for"),
  },
  async ({ email }: { email: string }) => {
    try {
      const data = await findAvailability(email);

      const responseText = data.value?.[0]?.availabilityView
        ? `Availability for ${email}: ${data.value[0].availabilityView}`
        : `No availability data found for ${email}.`;

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to get availability: ${error.message}`,
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
