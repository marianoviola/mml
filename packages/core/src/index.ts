export type EvidenceKind = "evidence" | "assumption" | "derived";

export interface ProvenancedValue {
  value: number;
  kind: EvidenceKind;
  source?: string;
  rationale?: string;
}

export interface CashFlow {
  year: number;
  amount: number;
}

export interface DcfInput {
  discountRate: number;
  cashFlows: CashFlow[];
}

export interface DcfResult {
  netPresentValue: number;
  discountedCashFlows: Array<CashFlow & { presentValue: number }>;
}

export function discountedCashFlow(input: DcfInput): DcfResult {
  if (input.discountRate <= -1) {
    throw new RangeError("discountRate must be greater than -1");
  }

  const discountedCashFlows = input.cashFlows.map((cashFlow) => ({
    ...cashFlow,
    presentValue:
      cashFlow.amount / Math.pow(1 + input.discountRate, cashFlow.year),
  }));

  return {
    netPresentValue: discountedCashFlows.reduce(
      (total, cashFlow) => total + cashFlow.presentValue,
      0,
    ),
    discountedCashFlows,
  };
}

export interface MobilityRateInput {
  monthlyCapital: number;
  monthlyMaintenance: number;
  monthlyRisk: number;
  monthlyAgency: number;
  monthlyLifecycleReserve: number;
  monthlyFinance: number;
  monthlyOperations: number;
  monthlyMargin: number;
}

export function mobilityRate(input: MobilityRateInput): number {
  return Object.values(input).reduce((total, value) => total + value, 0);
}
