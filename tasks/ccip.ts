import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

// ccip
export const factoryDeployInfrastructureCCIPTask = task(
  "ccip-factory-deploy",
  "Deploys Shares, SHA and bSHA tokens, adds them to the CCIP infrastructure. If needed deploys also factories on both source and destination."
)
  .addOption({
    name: "source",
    description: "Source Chain to operate in",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "destination",
    description: "Destination Chain to operate in",
    type: ArgumentType.STRING,
    defaultValue: "baseSepolia",
  })
  .addOption({
    name: "sourceFactory",
    description: "Aktionariat source chain Factory contract address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "destinationFactory",
    description: "Aktionariat destination chain Factory contract address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "sha",
    description: "Soruce chain SahresUnderAgreement Contract",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "bsha",
    description: "Destination chain BridgedSharesUnderAgreement Contract",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(() => import("./ccip/factoryDeployInfrastructureCCIPTask.ts"))
  .build();

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
  .setAction(() => import("./ccip/addDestinationChainTask.ts"))
  .build();

export const removeDestinationChainPoolTask = task(
  "ccip-remove-dpool",
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
  .setAction(() => import("./ccip/removeDestinationChainPoolTask.ts"))
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

export const haltBridgeTask = task(
  "ccip-halt-bridge",
  "Halts outgoing transfer of bridges for all destinations assed in"
)
  .addOption({
    name: "source",
    description: "Source network to deploy source contracts",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "stkp",
    description: "Source chain TokenPool address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "destination",
    description:
      "Destination network(s) to halt bridge for, multiple inputs can be passed in by [net1]-[net2]. Length must match the one of dtkp",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "dtkp",
    description: "Source chain TokenPool address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(() => import("./ccip/haltBridgeTask.ts"))
  .build();

export const enableBridgeTask = task(
  "ccip-enable-bridge",
  "Enables outgoing transfer of bridges for all destinations chain"
)
  .addOption({
    name: "source",
    description: "Source network to deploy source contracts",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "stkp",
    description: "Source chain TokenPool address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "destination",
    description:
      "Destination network(s) to enable bridge for, multiple inputs can be passed in by [net1]-[net2]. Length must match the one of dtkp",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "dtkp",
    description:
      "Source chain TokenPool address(es) to enable bridge for, multiple inputs can be passed in by [dest1]-[dest2]. Length must match the one of destination",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(() => import("./ccip/enableBridgeTask.ts"))
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
