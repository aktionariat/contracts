/**
 * Creation of Hardhat tasks file
 *
 * See https://hardhat.org/docs/plugin-development/tutorial/task
 *
 * To print help `npx hardhat <task-name> --help`
 */

import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

// ccip
export const allowTokenPoolOnBridgedSHATask = task(
  "ccip-allow-tkp-bsha",
  "Allowlist TokenPoolAddress to BridgedSharesUnderAgreement"
)
  .addOption({
    name: "tkp",
    description:
      "TokenPoolAddress to be allowed within BridgedSharesUnderAgreement",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "bsha",
    description: "BridgedSharesUnderAgreement token to allow TokenPoolAddress",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "ccipIgnition",
    description:
      "Collects information from ignition folder, for both tkp bsha addresses",
    type: ArgumentType.BOOLEAN,
    defaultValue: false,
  })
  .setAction(() => import("./ccip/allowTokenPoolOnBridgedSHATask.ts"))
  .build();

export const bridgeTokensTask = task(
  "ccip-bridge",
  "Bridge sha SharesUnderAgreement from source to destination network through CCIP"
)
  .addOption({
    name: "sha",
    description: "SharesUnderAgreement token contract address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "amount",
    description: "Amount of tokens to bridge",
    type: ArgumentType.STRING,
    defaultValue: "1",
  })
  .addOption({
    name: "source",
    description: "Network Source chain to bridge tokens from",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "destination",
    description: "Network Destination chain to bridge tokens to",
    type: ArgumentType.STRING,
    defaultValue: "fuji",
  })
  .addOption({
    name: "to",
    description:
      "Receiver of tokens, if omitted the network signer will be used",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "ccipIgnition",
    description:
      "Collects information from ignition folder, for sha address and source addresses based on network used",
    type: ArgumentType.FLAG,
    defaultValue: false,
  })
  .setAction(() => import("./ccip/bridgeTokensTask.ts"))
  .build();

export const deployCCIPContractsInfrastructureTask = task(
  "ccip-deploy",
  "Deploy CCIP contracts Infrastructure and setup"
)
  .addOption({
    name: "sha",
    description:
      "SharesUnderAgreement token contract address if deployer already has SHA token",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "terms",
    description: "Reset ignition deployments",
    type: ArgumentType.STRING,
    defaultValue: "T&C",
  })
  .addOption({
    name: "name",
    description: "Reset ignition deployments",
    type: ArgumentType.STRING,
    defaultValue: "Microstrategy Shares",
  })
  .addOption({
    name: "symbol",
    description: "Reset ignition deployments",
    type: ArgumentType.STRING,
    defaultValue: "MSTR",
  })
  .addOption({
    name: "source",
    description: "Source chain network",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "destination",
    description: "Destination chain network",
    type: ArgumentType.STRING,
    defaultValue: "fuji",
  })
  .addOption({
    name: "reset",
    description: "Reset ignition deployments",
    type: ArgumentType.FLAG,
    defaultValue: false,
  })
  .setAction(() => import("./ccip/deployCCIPContractsInfrastructureTask.ts"))
  .build();

export const addDestinationChainTask = task(
  "ccip-add",
  "Deploy CCIP contracts Infrastructure and setup to a new destination chain from an already deployed source infrastructure"
)
  .addOption({
    name: "source",
    description: "Source chain network",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "destination",
    description: "Destination chain network",
    type: ArgumentType.STRING,
    defaultValue: "baseSepolia",
  })
  .addOption({
    name: "stkp",
    description: "Source chain TokenPool address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "sha",
    description: "SharesUnderAgreement token contract address of source chain",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "terms",
    description: "Bridged Shares Under Agreement terms",
    type: ArgumentType.STRING,
    defaultValue: "T&C",
  })
  .addOption({
    name: "name",
    description: "Bridged Shares Under Agreement name",
    type: ArgumentType.STRING,
    defaultValue: "Microstrategy Shares",
  })
  .addOption({
    name: "symbol",
    description: "Bridged Shares Under Agreement symbol",
    type: ArgumentType.STRING,
    defaultValue: "MSTR",
  })
  .addOption({
    name: "reset",
    description: "Reset ignition deployments",
    type: ArgumentType.FLAG,
    defaultValue: false,
  })
  .setAction(() => import("./ccip/addDestinationChainTask.ts"))
  .build();

export const estimateCCIPDeploymentGasTask = task(
  "ccip-estimate-deployment-gas",
  "Estimate gas cost for CCIP testnet deployment"
)
  .addOption({
    name: "source",
    description: "Source network to deploy source contracts",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "destination",
    description: "Destination network to deply destination contracts",
    type: ArgumentType.STRING,
    defaultValue: "fuji",
  })
  .setAction(() => import("./ccip/estimateCCIPDeploymentGasTask.ts"))
  .build();

// shares
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
  .addOption({
    name: "ccipIgnition",
    description: "Use CCIP ignition deployment informations",
    type: ArgumentType.FLAG,
    defaultValue: false,
  })
  .setAction(() => import("./shares/mintWrapSharesTask.ts"))
  .build();
