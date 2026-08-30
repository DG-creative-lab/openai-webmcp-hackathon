import { createRoot } from "react-dom/client";
import App from "./App";
import { registerWebMCPToolsWithRetry } from "./webmcp/registerTools";

registerWebMCPToolsWithRetry().catch((error) => {
  console.error("WebMCP tool registration failed", error);
});

createRoot(document.getElementById("root")!).render(<App />);
