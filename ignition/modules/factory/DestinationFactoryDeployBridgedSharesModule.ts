import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {
  BridgedSharesUnderAgreementDeploymentData,
  ChainlinkAddresses,
} from "./lib/types.ts";
import { RemoteTokenPoolInfo } from "../ccip/lib/types.ts";
import { DestinationParamsRuntimeValue } from "./lib/types.ts";

export default buildModule(
  "DestinationFactoryDeployBridgedSharesModule",
  (m) => {
    const factoryDestination = m.getParameter<string>("factoryDestination");

    const bridgedSharesUnderAgreementDeploymentData =
      m.getParameter<BridgedSharesUnderAgreementDeploymentData>(
        "bridgedSharesUnderAgreementDeploymentData"
      );
    const chainlinkAddresses =
      m.getParameter<ChainlinkAddresses>("chainlinkAddresses");
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
      remoteTokenPools,
    };
    // DeploymentData bridgedSharesUnderAgreement;
    // DeploymentData brunMintTokenPool;
    // ChainlinkAddresses chainlink;
    // // Prediction of addresses is left either to backend
    // // or directly to chainlink token pool factory
    // ITokenPoolFactory.RemoteTokenPoolInfo[] remoteTokenPools;
    // bytes32 salt;

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
      BurnMintTokenPool: m.contractAt("BurnMintTokenPoolProxy", pool),
    };
  }
);
