/**
 * Estimation CLI tool for deployment costs of CCIP Testnet contracts
 *
 * Since we simulate only gas cost we need to respect constructor arguments
 * types and dependencies. Usually constructors do not have strict requirements,
 * if true we use mock arguments
 */

import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Result } from "hardhat/types/utils";
import { successfulResult } from "hardhat/utils/result";

import {
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  formatEther,
  formatUnits,
} from "ethers";
import type { ContractDeployTransaction } from "ethers/contract";

import { printAndReturnErrorResult } from "../utils/error.ts";

import KEYS_TEMPLATE from "../../KEYS.ts";

interface EstimateCCIPDeploymentGasTaskArguments {
  source: string;
  destination: string;
}

type DeploymentCost = {
  totalGas: bigint;
  gasPrice: bigint;
  costWei: bigint;
  costEth: string;
};

async function estimateDeploymentCostSourceChain(
  _hre: HardhatRuntimeEnvironment,
  rpcUrl: string
): Promise<DeploymentCost | null> {
  const provider = new JsonRpcProvider(rpcUrl);
  const deployer = Wallet.createRandom();

  // an IERC20 interface is needed for SHA constructor,
  // sepolia LINK (ERC20)
  // NOTE:  if you use other source chains this needs to be changed
  //        probably useful to make a dictionary chain -> token
  const IERC20: string = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

  // get artifacts and constructors
  const deployments = [
    {
      artifactName: "Shares",
      constructor: [
        // string memory _symbol,
        // string memory _name,
        // string memory _terms,
        // address _owner
        "Symbol",
        "Name",
        "Tems",
        deployer.address,
      ],
      output: {},
    },
    {
      artifactName: "SharesUnderAgreement",
      constructor: [
        // IERC20 base_,
        // string memory _terms,
        // uint8 _decimals,
        // address _owner
        IERC20,
        "Terms",
        0n,
        deployer.address,
      ],
    },
  ];

  // construct
  const deploymentTxns: ContractDeployTransaction[] = [];
  for (let d of deployments) {
    const artifact = await _hre.artifacts.readArtifact(d.artifactName);

    // make constract
    const factory = new ContractFactory(
      artifact.abi,
      artifact.bytecode,
      deployer
    );

    // add txn
    const txn = await factory.getDeployTransaction(...d.constructor);

    deploymentTxns.push(txn);
  }

  // estimate
  let totalGas = 0n;
  for (let dtxn of deploymentTxns) {
    totalGas += await provider.estimateGas({
      ...dtxn,
      from: deployer.address,
    });
  }

  // compute data
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;

  if (gasPrice === null) {
    return null;
  }

  const costWei = totalGas * gasPrice;

  return {
    totalGas,
    gasPrice,
    costWei,
    costEth: formatEther(costWei),
  };
}

async function estimateDeploymentCostDestinationChain(
  _hre: HardhatRuntimeEnvironment,
  rpcUrl: string
): Promise<DeploymentCost | null> {
  const provider = new JsonRpcProvider(rpcUrl);
  const deployer = Wallet.createRandom();

  // get artifacts and constructors
  const deployments = [
    {
      artifactName: "BridgedSharesUnderAgreement",
      constructor: [
        // string memory _symbol,
        // string memory _name,
        // string memory _terms,
        // address _owner
        "Symbol",
        "Name",
        "Tems",
        deployer.address,
      ],
    },
  ];

  // construct
  const deploymentTxns: ContractDeployTransaction[] = [];
  for (let d of deployments) {
    const artifact = await _hre.artifacts.readArtifact(d.artifactName);

    // make constract
    const factory = new ContractFactory(
      artifact.abi,
      artifact.bytecode,
      deployer
    );

    // add txn
    deploymentTxns.push(await factory.getDeployTransaction(...d.constructor));
  }

  // estimate
  let totalGas = 0n;
  for (let dtxn of deploymentTxns) {
    totalGas += await provider.estimateGas({
      ...dtxn,
      from: deployer.address,
    });
  }

  // compute data
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;

  if (gasPrice === null) {
    return null;
  }

  const costWei = totalGas * gasPrice;

  return {
    totalGas,
    gasPrice,
    costWei,
    costEth: formatEther(costWei),
  };
}

export default async function (
  _taskArguments: EstimateCCIPDeploymentGasTaskArguments,
  _hre: HardhatRuntimeEnvironment
): Promise<Result<string[], string>> {
  const source = _taskArguments.source;
  const destination = _taskArguments.destination;

  // colllect RPCs
  if (!KEYS_TEMPLATE) {
    return printAndReturnErrorResult("KEYS_TEMPLATE in KEYS.ts not defined");
  }

  if (!(source in KEYS_TEMPLATE.alchemy)) {
    return printAndReturnErrorResult(
      "source RPC within KEYS_TEMPLATE.alchemy in KEYS.ts is not provided"
    );
  }
  if (!(destination in KEYS_TEMPLATE.alchemy)) {
    return printAndReturnErrorResult(
      "destination RPC within KEYS_TEMPLATE.alchemy in KEYS.ts is not provided"
    );
  }

  const sourceCost = await estimateDeploymentCostSourceChain(
    _hre,
    KEYS_TEMPLATE.alchemy[source as keyof typeof KEYS_TEMPLATE.alchemy]
  );
  if (!sourceCost) {
    return printAndReturnErrorResult("could not esimate gas for source chain");
  }

  const destinationCost = await estimateDeploymentCostDestinationChain(
    _hre,
    KEYS_TEMPLATE.alchemy[destination as keyof typeof KEYS_TEMPLATE.alchemy]
  );
  if (!destinationCost) {
    return printAndReturnErrorResult(
      "could not esimate gas for destination chain"
    );
  }

  console.log(`\n\n=== Source Chain: ${source} ===`);

  console.log(`Gas: ${sourceCost.totalGas}`);
  console.log(`Gas price: ${formatUnits(sourceCost.gasPrice, "gwei")} gwei`);
  console.log(`Cost: ${sourceCost.costEth} native token`);

  console.log(`\n\n=== Destination Chain: ${destination} ===`);

  console.log(`Gas: ${destinationCost.totalGas}`);
  console.log(
    `Gas price: ${formatUnits(destinationCost.gasPrice, "gwei")} gwei`
  );
  console.log(`Cost: ${destinationCost.costEth} native token`);

  console.log("\n\n");
  return successfulResult([]);
}
