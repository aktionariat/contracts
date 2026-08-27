import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {
  BridgedSharesUnderAgreementDeploymentData,
  DestinationParamsRuntimeValue,
} from "./lib/types.ts";
import { RemoteTokenPoolInfo } from "../ccip/lib/types.ts";

/**
 * Deploys the whole destination-chain infrastructure through the
 * TokenDeploymentManagerDestination: BridgedSharesUnderAgreement and the
 * BurnMintTokenPool (with its CCIP settings).
 *
 * The deployed addresses are read from the manager's `InfraDeploymentSource`
 * event.
 */
export default buildModule(
  "DestinationFactoryDeployBridgedSharesModule",
  (m) => {
    const factoryDestination = m.getParameter<string>("factoryDestination");

    const bridgedSharesUnderAgreementDeploymentData =
      m.getParameter<BridgedSharesUnderAgreementDeploymentData>(
        "bridgedSharesUnderAgreementDeploymentData"
      );
    const remoteTokenPools =
      m.getParameter<RemoteTokenPoolInfo[]>("remoteTokenPools");

    const futureOwner = m.getParameter<string>("futureOwner");

    const salt = m.getParameter<string>("salt");

    const FactoryDestination = m.contractAt(
      "TokenDeploymentManagerDestination",
      factoryDestination
    );

    const destinationParams: DestinationParamsRuntimeValue = {
      bridgedSharesUnderAgreement: bridgedSharesUnderAgreementDeploymentData,
      remoteTokenPools,
    };

    const deployTx = m.call(
      FactoryDestination,
      "deploy",
      [destinationParams, futureOwner, salt],
      {
        after: [FactoryDestination],
      }
    );

    const bridgedSharesUnderAgreement = m.readEventArgument(
      deployTx,
      "InfraDeploymentSource",
      "bridgedSharesUnderAgreement"
    );
    const burnMintTokenPool = m.readEventArgument(
      deployTx,
      "InfraDeploymentSource",
      "burnMintTokenPool"
    );

    return {
      BridgedSharesUnderAgreement: m.contractAt(
        "BridgedSharesUnderAgreement",
        bridgedSharesUnderAgreement
      ),
      BurnMintTokenPool: m.contractAt("BurnMintTokenPool", burnMintTokenPool),
    };
  }
);