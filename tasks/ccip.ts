import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

// Core CCIP Tasks
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

export const manageDestinationChainPoolTask = task(
  "ccip-manage-dpool",
  "Removes a destination chain pool from a source chain pool"
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
    name: "dtkp",
    description: "Source chain TokenPool address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "stkp",
    description: "Source chain TokenPool address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(() => import("./ccip/manageDestinationChainPoolTask.ts"))
  .build();

export const manageBridgeTask = task(
  "ccip-manage-bridge",
  "Halts or Activates outgoing transfer of bridges for all destinations"
)
  .addOption({
    name: "source",
    description: "Source network to halt the bridge",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "destination",
    description:
      "Destination network(s) to enable bridge for, multiple inputs can be passed in by [net1]-[net2]. Length must match the one of dtkp",
    type: ArgumentType.STRING,
    defaultValue: "baseSepolia",
  })
  .addOption({
    name: "stkp",
    description: "Source chain Token Pool address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "halt",
    description: "Whether to halt or acivate the bridgr",
    type: ArgumentType.FLAG,
    defaultValue: false,
  })
  .addOption({
    name: "reset",
    description: "If to reset ignition deployment folder",
    type: ArgumentType.FLAG,
    defaultValue: false,
  })
  .setAction(() => import("./ccip/manageBridgeTask.ts"))
  .build();

// Utils CCIP Tasks
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

export const resetDestinationChainTask = task(
  "ccip-reset-dpool",
  "Resets a destination chain pool from a source chain pool, removes it and sets a new destination token and destination pool"
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
    name: "dtkp",
    description: "Source chain TokenPool address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "bsha",
    description: "Destination chain BridgedSharesUnderAgreement address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(() => import("./ccip/resetDestinationChainTask.ts"))
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
