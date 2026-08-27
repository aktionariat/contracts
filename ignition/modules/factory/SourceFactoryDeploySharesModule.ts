import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {
  SharesDeploymentData,
  SharesUnderAgreementDeploymentData,
  SourceParamsRuntimeValue,
} from "./lib/types.ts";
import { RemoteTokenPoolInfo } from "../ccip/lib/types.ts";

/**
 * Deploys the whole source-chain infrastructure through the
 * TokenDeploymentManagerSource: Shares, SharesUnderAgreement and the
 * LockReleaseTokenPool (with its CCIP settings).
 *
 * The deployed addresses are read from the manager's `InfraDeploymentSource`
 * event.
 */
export default buildModule("SourceFactoryDeploySharesModule", (m) => {
  const sourceFactory = m.getParameter<string>("sourceFactory");

  const sharesDeploymentData = m.getParameter<SharesDeploymentData>(
    "sharesDeploymentData"
  );
  const sharesUnderAgreementDeploymentData =
    m.getParameter<SharesUnderAgreementDeploymentData>(
      "sharesUnderAgreementDeploymentData"
    );
  const remoteTokenPools =
    m.getParameter<RemoteTokenPoolInfo[]>("remoteTokenPools");

  const futureOwner = m.getParameter<string>("futureOwner");

  const salt = m.getParameter<string>("salt");

  const FactorySource = m.contractAt(
    "TokenDeploymentManagerSource",
    sourceFactory
  );

  const sourceParams: SourceParamsRuntimeValue = {
    shares: sharesDeploymentData,
    sharesUnderAgreement: sharesUnderAgreementDeploymentData,
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

  const shares = m.readEventArgument(deployTx, "InfraDeploymentSource", "shares");
  const sharesUnderAgreement = m.readEventArgument(
    deployTx,
    "InfraDeploymentSource",
    "sharesUnderAgreement"
  );
  const lockReleaseTokenPool = m.readEventArgument(
    deployTx,
    "InfraDeploymentSource",
    "lockReleaseTokenPool"
  );

  return {
    Shares: m.contractAt("Shares", shares),
    SharesUnderAgreement: m.contractAt(
      "SharesUnderAgreement",
      sharesUnderAgreement
    ),
    LockReleaseTokenPool: m.contractAt("LockReleaseTokenPool", lockReleaseTokenPool),
  };
});