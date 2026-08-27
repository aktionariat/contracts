import fs from "node:fs";
import path from "node:path";

const IGNITION_DEPLOYMENTS_JSON = "deployed_addresses.json";
const IGNITION_DEPLOYMENTS_BASE_PATH = "ignition/deployments";
const IGNITION_DEPLYMENTS_CCIP_FOLDER_PATH = "ccip";
// better to add within a folder all ccip related deployments

// something like ignition/deplyments/[partner-name]/[deplyment-name]/deployed_addresses.json and so on

// TODO check correctness, we moved shares to different deplyment
// TODO add also project name to deployment since there can be multiple ones
// Ask if path is correct, or if need to move another direction

// TODO some really need additional parameters to be
//      correctly identified

// unused
export function getDeploymentName(name: string) {
  return `ccip-testnet-${name}`;
}

// sha deployed
export function getSharesDeploymentName(name: string) {
  return `ccip-testnet-shares-${name}`;
}

// bsha deployed
export function getBridgedSharesDeploymentName(name: string) {
  return `ccip-testnet-bridged-shares-${name}`;
}

// bsha set pool
export function getBridgedSharesSetpoolDeploymentName(name: string) {
  return `ccip-testnet-bridged-shares-setpool-${name}`;
}

// factory deployment
export function getFactoryDeploymentName(name: string) {
  return `ccip-testnet-factory-${name}`;
}

// settings
export function getSettingsDeploymentName(name: string) {
  return `ccip-testnet-setting-${name}`;
}

// update source chain
export function getUpdateSourceChainName(name: string) {
  return `ccip-testnet-update-source-${name}`;
}

// remove from source chain a destination
export function getRemoveDestinationChainPoolName(name: string) {
  return `ccip-testnet-remove-destination-pool-${name}`;
}
// add for source chain a token
export function getAddDestinationChainPoolName(name: string) {
  return `ccip-testnet-remove-destination-pool-${name}`;
}

// reset source chain for destination
export function getResetDestinationChainPoolName(name: string) {
  return `ccip-testnet-remove-destination-pool-${name}`;
}

// reset source chain for destination
export function getSetRateLimiterName(name: string) {
  return `ccip-testnet-set-rate-limiter-${name}`;
}

export function addTimeToName(name: string): string {
  const now = new Date();

  const pad = (n: number) => n.toString().padStart(2, "0");

  const timestamp =
    `${pad(now.getDate())}-` +
    `${pad(now.getMonth() + 1)}-` +
    `${now.getFullYear().toString().slice(-2)}-` +
    `${pad(now.getHours())}-` +
    `${pad(now.getMinutes())}-` +
    `${pad(now.getSeconds())}`;

  return `${name}-at-${timestamp}`;
}

const deployments = [
  getDeploymentName,
  getSharesDeploymentName,
  getBridgedSharesDeploymentName,
  getBridgedSharesSetpoolDeploymentName,
  getFactoryDeploymentName,
  getSettingsDeploymentName,
];

// // // By modifing following objects, changes what the script looks for within deplyments scripts
const sourceChainModule = "SourceChainModule#";
const destinationChainModule = "DestinationChainModule#";
const AddressesDeploymentNames = {
  source: {
    sharesAddress: sourceChainModule.concat("Shares"),
    sha: sourceChainModule.concat("SharesUnderAgreement"),
  },
  destination: {
    bridgedSha: destinationChainModule.concat("BridgedSharesUnderAgreement"),
  },
};
// // //

export type AddressesBundle = {
  [Section in keyof typeof AddressesDeploymentNames]: {
    [Key in keyof (typeof AddressesDeploymentNames)[Section]]?: string;
  };
};
export type AddressesBundleSourceKeys =
  keyof typeof AddressesDeploymentNames.source;
export type AddressesBundleDestinationKeys =
  keyof typeof AddressesDeploymentNames.destination;

function _readCCIPIgnitionAddressesJSON(
  path: string | undefined
): Record<string, string> | undefined {
  if (!path) return undefined;
  if (!fs.existsSync(path)) {
    return undefined;
  }

  return JSON.parse(fs.readFileSync(path, "utf-8")) as Record<string, string>;
}

export default function readCCIPIgnitionAddresses(
  source: string,
  destination: string | undefined = undefined
): AddressesBundle | undefined {
  // at leas source always needed
  // maybe destination not
  // Example:
  // ignition/deployments/ccip-testnet-sepolia/deployed_addresses.json
  const deploymentPathSource = path.resolve(
    process.cwd(),
    IGNITION_DEPLOYMENTS_BASE_PATH,
    getDeploymentName(source),
    IGNITION_DEPLOYMENTS_JSON
  );
  const deploymentPathDestination = destination
    ? path.resolve(
        process.cwd(),
        IGNITION_DEPLOYMENTS_BASE_PATH,
        getDeploymentName(destination),
        IGNITION_DEPLOYMENTS_JSON
      )
    : destination;

  const deployedAddressesSource =
    _readCCIPIgnitionAddressesJSON(deploymentPathSource);
  const deployedAddressesDestination = _readCCIPIgnitionAddressesJSON(
    deploymentPathDestination
  );

  if (!deployedAddressesSource && !deployedAddressesDestination) {
    return undefined;
  }

  let bundle: AddressesBundle = {
    source: {},
    destination: {},
  };

  // see AddressesDeploymentNames
  if (deployedAddressesSource) {
    for (let k of Object.keys(AddressesDeploymentNames.source)) {
      bundle.source[k as AddressesBundleSourceKeys] =
        deployedAddressesSource[
          AddressesDeploymentNames.source[k as AddressesBundleSourceKeys]
        ];
    }
  }

  if (deployedAddressesDestination) {
    for (let k in Object.keys(AddressesDeploymentNames.destination)) {
      bundle.destination[k as AddressesBundleDestinationKeys] =
        deployedAddressesDestination[
          AddressesDeploymentNames.destination[
            k as AddressesBundleDestinationKeys
          ]
        ];
    }
  }

  return bundle;
}

// delte folder, used to force a --reset by hardhat task CLI
export function resetCCIPIgnitionDeploymentFolder(
  sourceOrDestinationNetwork: string
): void {
  const deploymentPath = path.resolve(
    process.cwd(),
    IGNITION_DEPLOYMENTS_BASE_PATH,
    getDeploymentName(sourceOrDestinationNetwork)
  );

  fs.rmSync(deploymentPath, {
    recursive: true,
    force: true,
  });
}

export function resetAllCCIPIgnitionDeploymentFolder(
  sourceOrDestinationNetwork: string
): void {
  for (const getName of deployments) {
    const deploymentPath = path.resolve(
      process.cwd(),
      IGNITION_DEPLOYMENTS_BASE_PATH,
      getName(sourceOrDestinationNetwork)
    );

    fs.rmSync(deploymentPath, {
      recursive: true,
      force: true,
    });
  }
}
