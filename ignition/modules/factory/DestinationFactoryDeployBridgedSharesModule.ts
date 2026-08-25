import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {
  BridgedSharesUnderAgreementDeploymentData,
  DestinationChainlinkAddresses,
  DestinationParamsRuntimeValue,
} from "./lib/types.ts";
import { RemoteTokenPoolInfo } from "../ccip/lib/types.ts";

export default buildModule(
  "DestinationFactoryDeployBridgedSharesModule",
  (m) => {
    const factoryDestination = m.getParameter<string>("factoryDestination");

    const bridgedSharesUnderAgreementDeploymentData =
      m.getParameter<BridgedSharesUnderAgreementDeploymentData>(
        "bridgedSharesUnderAgreementDeploymentData"
      );
    const chainlinkAddresses =
      m.getParameter<DestinationChainlinkAddresses>("chainlinkAddresses");
    const burnMintTokenPoolBytecode = m.getParameter<string>(
      "burnMintTokenPoolBytecode"
    );
    const remoteTokenPools =
      m.getParameter<RemoteTokenPoolInfo[]>("remoteTokenPools");

    const futureOwner = m.getParameter<string>("futureOwner");

    const salt = m.getParameter<string>("salt");

    const FactoryDestination = m.contractAt(
      "FactoryDestination",
      factoryDestination
    );

    const destinationParams: DestinationParamsRuntimeValue = {
      bridgedSharesUnderAgreement: bridgedSharesUnderAgreementDeploymentData,
      chainlink: chainlinkAddresses,
      burnMintTokenPoolBytecode,
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

    const sourceWrapper = m.readEventArgument(
      deployTx,
      "BridgedSharesUnderAgreementDeployed",
      "wrapper"
    );
    const pool = m.readEventArgument(deployTx, "TokenPoolDeployed", "pool");
    return {
      BridgedSharesUnderAgreement: m.contractAt(
        "BridgedSharesUnderAgreement",
        sourceWrapper
      ),
      BurnMintTokenPool: m.contractAt("BurnMintTokenPool", pool),
    };
  }
);
