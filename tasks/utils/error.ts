import { errorResult } from "hardhat/utils/result";

export function printAndReturnErrorResult(message: string) {
  console.error(message);
  return errorResult(message);
}
