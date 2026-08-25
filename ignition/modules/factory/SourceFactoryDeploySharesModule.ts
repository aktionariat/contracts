import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {
  SourceChainlinkAddresses,
  SharesDeploymentData,
  SharesUnderAgreementDeploymentData,
  SourceParamsRuntimeValue,
} from "./lib/types.ts";
import { RemoteTokenPoolInfo } from "../ccip/lib/types.ts";

export default buildModule("SourceFactoryDeploySharesModule", (m) => {
  const sourceFactory = m.getParameter<string>("sourceFactory");

  const sharesDeploymentData = m.getParameter<SharesDeploymentData>(
    "sharesDeploymentData"
  );
  const sharesUnderAgreementDeploymentData =
    m.getParameter<SharesUnderAgreementDeploymentData>(
      "sharesUnderAgreementDeploymentData"
    );
  const chainlinkAddresses =
    m.getParameter<SourceChainlinkAddresses>("chainlinkAddresses");
  const lockReleaseTokenPoolBytecode = m.getParameter<string>(
    "lockReleaseTokenPoolBytecode"
  );
  const remoteTokenPools =
    m.getParameter<RemoteTokenPoolInfo[]>("remoteTokenPools");

  const futureOwner = m.getParameter<string>("futureOwner");

  const salt = m.getParameter<string>("salt");

  const FactorySource = m.contractAt("FactorySource", sourceFactory);

  const sourceParams: SourceParamsRuntimeValue = {
    shares: sharesDeploymentData,
    sharesUnderAgreement: sharesUnderAgreementDeploymentData,
    chainlink: chainlinkAddresses,
    lockReleaseTokenPoolBytecode,
    remoteTokenPools,
  };

  const deployTx = m.call(
    FactorySource,
    "deploy",
    [sourceParams, futureOwner, salt],
    {
      after: [FactorySource],
    }
  );

  const sourceToken = m.readEventArgument(deployTx, "SharesDeployed", "token");
  const sourceWrapper = m.readEventArgument(
    deployTx,
    "SharesUnderAgreementDeployed",
    "wrapper"
  );
  const pool = m.readEventArgument(deployTx, "TokenPoolDeployed", "pool");
  return {
    Shares: m.contractAt("Shares", sourceToken),
    SharesUnderAgreement: m.contractAt("SharesUnderAgreement", sourceWrapper),
    LockReleaseTokenPool: m.contractAt("LockReleaseTokenPool", pool),
  };
});
