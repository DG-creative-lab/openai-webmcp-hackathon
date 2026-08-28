interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

interface Document {
  modelContext?: {
    registerTool: (definition: WebMCPToolDefinition) => Promise<void>;
  };
}
