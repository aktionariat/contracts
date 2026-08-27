export type EVMTokenAmount = {
  token: string;
  amount: bigint;
};

export type EVM2AnyMessage = {
  receiver: string; // abi.encode(receiver address)
  data: string;
  tokenAmounts: EVMTokenAmount[];
  feeToken: string; // address(0) for native token
  extraArgs: string;
};
