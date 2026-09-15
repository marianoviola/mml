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
    presentValue: cashFlow.amount / Math.pow(1 + input.discountRate, cashFlow.year),
  }));

  return {
    netPresentValue: discountedCashFlows.reduce((total, cashFlow) => total + cashFlow.presentValue, 0),
    discountedCashFlows,
  };
}

/** Level monthly payment of an amortising loan. */
export function annuityPayment(principal: number, annualRate: number, months: number): number {
  if (months <= 0) throw new RangeError("months must be positive");
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}
