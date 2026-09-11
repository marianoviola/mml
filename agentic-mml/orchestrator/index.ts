import type { DomainTool } from "../tools/domain-tool.js";

export interface LifecycleState {
  customerId: string;
  vehicleId?: string;
}

export interface Orchestrator {
  tools: DomainTool[];

  dispatch(state: LifecycleState): Promise<LifecycleState>;
}
