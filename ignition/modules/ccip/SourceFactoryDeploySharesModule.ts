import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {
  ChainlinkAddresses,
  DeploymentData,
  DeploymentDataSHA,
  RemoteTokenPoolInfoSolidityParameter,
  SourceParams,
} from "./lib/types.ts";

export default buildModule("SourceFactoryDeploySharesModule", (m) => {
  const factorySource = m.getParameter<string>("factorySource");

  const sharesTokenDeploymentData = m.getParameter<DeploymentData>(
    "sharesTokenDeploymentData"
  );
  const sharesUnderAgreementDeploymentDataSHA =
    m.getParameter<DeploymentDataSHA>("sharesUnderAgreementDeploymentDataSHA");
  const lockReleaseTokenPoolBytecode = m.getParameter<string>(
    "lockReleaseTokenPoolBytecode"
  );
  const chainlinkAddresses =
    m.getParameter<ChainlinkAddresses>("chainlinkAddresses");
  const remoteTokenPools =
    m.getParameter<RemoteTokenPoolInfoSolidityParameter[]>("remoteTokenPools");
  const salt = m.getParameter<string>("salt");

  const futureOwner = m.getParameter<string>("futureOwner");

  const FactorySource = m.contractAt("CCIPFactorySource", factorySource);

  const sourceParams: SourceParams = {
    shares: sharesTokenDeploymentData,
    sharesUnderAgreement: sharesUnderAgreementDeploymentDataSHA,
    chainlink: chainlinkAddresses,
    lockReleaseTokenPoolBytecode,
    remoteTokenPools,
    salt,
  };

  const deployTx = m.call(
    FactorySource,
    "deploy",
    [sourceParams, futureOwner],
    {
      after: [FactorySource],
    }
  );

  const sourceToken = m.readEventArgument(
    deployTx,
    "SourceSharesTokenResolved",
    "sourceToken"
  );
  const sourceWrapper = m.readEventArgument(
    deployTx,
    "SourceSharesUnderAgreementResolved",
    "sourceWrapper"
  );
  const pool = m.readEventArgument(deployTx, "SourceTokenPoolDeployed", "pool");
  return {
    Shares: m.contractAt("Shares", sourceToken),
    SharesUnderAgreement: m.contractAt("SharesUnderAgreement", sourceWrapper),
    LockReleaseTokenPool: m.contractAt("LockReleaseTokenPool", pool),
  };
});
