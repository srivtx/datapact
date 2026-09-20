import { check, lintOnly } from "./check.ts";
import { formatText } from "./report.ts";

const SERVER_NAME = "datapact";

const TOOLS = [
  {
    name: "contract_lint",
    description:
      "Lint an Open Data Contract Standard contract (YAML or JSON) and return the findings. No network access.",
    inputSchema: {
      type: "object",
      properties: {
        contract: { type: "string", description: "The contract document as YAML or JSON text." },
        name: { type: "string", description: "Optional label for the contract in the output." },
      },
      required: ["contract"],
      additionalProperties: false,
    },
  },
  {
    name: "contract_check",
    description:
      "Lint a contract and validate a CSV dataset against it, returning the combined findings.",
    inputSchema: {
      type: "object",
      properties: {
        contract: { type: "string", description: "The contract document as YAML or JSON text." },
        csv: { type: "string", description: "The CSV dataset as text, including the header row." },
        name: { type: "string", description: "Optional label for the dataset in the output." },
      },
      required: ["contract", "csv"],
      additionalProperties: false,
    },
  },
];

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "contract_lint": {
      const contract = asString(args["contract"]);
      if (contract.trim().length === 0) return "contract_lint requires the contract text.";
      const result = lintOnly(contract, asString(args["name"], "contract"));
      return formatText(result);
    }
    case "contract_check": {
      const contract = asString(args["contract"]);
      const csv = asString(args["csv"]);
      if (contract.trim().length === 0) return "contract_check requires the contract text.";
      if (csv.trim().length === 0) return "contract_check requires the CSV text.";
      const result = check(contract, csv, {
        contractName: asString(args["name"], "contract"),
        datasetName: "dataset",
      });
      return formatText(result);
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function reply(id: unknown, body: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, ...body })}\n`);
}

async function handle(message: Record<string, unknown>, version: string): Promise<void> {
  const id = message["id"];
  const method = message["method"];
  if (typeof method !== "string") return;

  if (method === "initialize") {
    const params = (message["params"] ?? {}) as Record<string, unknown>;
    reply(id, {
      result: {
        protocolVersion: asString(params["protocolVersion"], "2024-11-05"),
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version },
      },
    });
    return;
  }
  if (method === "notifications/initialized") return;
  if (method === "ping") {
    reply(id, { result: {} });
    return;
  }
  if (method === "tools/list") {
    reply(id, { result: { tools: TOOLS } });
    return;
  }
  if (method === "tools/call") {
    const params = (message["params"] ?? {}) as Record<string, unknown>;
    const name = asString(params["name"]);
    const args = (params["arguments"] ?? {}) as Record<string, unknown>;
    try {
      const text = await callTool(name, args);
      reply(id, { result: { content: [{ type: "text", text }] } });
    } catch (err) {
      reply(id, {
        result: {
          content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
          isError: true,
        },
      });
    }
    return;
  }
  if (id !== undefined) {
    reply(id, { error: { code: -32601, message: `method not found: ${method}` } });
  }
}

export async function serve(options: { version: string }): Promise<void> {
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (line.length === 0) continue;
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof message === "object" && message !== null) {
        await handle(message as Record<string, unknown>, options.version);
      }
    }
  }
}
