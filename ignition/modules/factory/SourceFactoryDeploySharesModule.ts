import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {
  ChainlinkAddresses,
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
    m.getParameter<ChainlinkAddresses>("chainlinkAddresses");
  const remoteTokenPools =
    m.getParameter<RemoteTokenPoolInfo[]>("remoteTokenPools");

  const futureOwner = m.getParameter<string>("futureOwner");

  const salt = m.getParameter<string>("salt");

  const FactorySource = m.contractAt("FactorySource", sourceFactory);

  const sourceParams: SourceParamsRuntimeValue = {
    shares: sharesDeploymentData,
    sharesUnderAgreement: sharesUnderAgreementDeploymentData,
    chainlink: chainlinkAddresses,
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

  const sourceToken = m.readEventArgument(
    deployTx,
    "SharesDeployed",
    "proxyToken"
  );
  const sourceWrapper = m.readEventArgument(
    deployTx,
    "SharesUnderAgreementDeployed",
    "proxyWrapper"
  );
  const pool = m.readEventArgument(deployTx, "TokenPoolDeployed", "proxyPool");
  return {
    Shares: m.contractAt("Shares", sourceToken),
    SharesUnderAgreement: m.contractAt("SharesUnderAgreement", sourceWrapper),
    LockReleaseTokenPool: m.contractAt("LockReleaseTokenPoolProxy", pool),
  };
});
