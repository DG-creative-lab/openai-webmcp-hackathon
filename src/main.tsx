import { createRoot } from "react-dom/client";
import App from "./App";
import { registerWebMCPTools } from "./webmcp/registerTools";

registerWebMCPTools().catch((error) => {
  console.error("WebMCP tool registration failed", error);
});

createRoot(document.getElementById("root")!).render(<App />);
