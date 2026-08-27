interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

interface Document {
  modelContext?: {
    registerTool: (definition: WebMCPToolDefinition) => Promise<void>;
  };
}
