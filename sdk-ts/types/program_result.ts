export interface ProgramResult {
  context: {
    slot: number;
  };
  value: {
    amount: string;
    decimals: number;
    uiAmount: number;
    uiAmountString: string;
  };
}
