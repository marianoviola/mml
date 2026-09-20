import type { DomainTool } from "./domain-tool.js";

export interface MaintenanceTool extends DomainTool {
  domain: "maintenance";
}
