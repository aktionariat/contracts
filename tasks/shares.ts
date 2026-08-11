import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

// Core Shares and SHA tasks
export const mintWrapSharesTask = task(
  "mint-wrap-shares",
  "Mint and Wrap Shares under Agreement token on network. Assumes Network singer is the contract owner"
)
  .addOption({
    name: "shares",
    description: "Shares token address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "sha",
    description: "SharesUnderAgreement token address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "amount",
    description: "Human-readable amount to mint",
    type: ArgumentType.STRING,
    defaultValue: "100",
  })
  .addOption({
    name: "to",
    description: "Recipient address, if undefined defaults to netwoek signer",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(() => import("./shares/mintWrapSharesTask.ts"))
  .build();
