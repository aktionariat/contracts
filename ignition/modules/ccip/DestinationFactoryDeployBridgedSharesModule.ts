import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import {
  BridgedSharesUnderAgreementDeploymentData,
  ChainlinkAddresses,
  DestinationParams,
  RemoteTokenPoolInfoSolidityParameter,
} from "./lib/types.ts";

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
    const burnMintTokenPoolBytecode = m.getParameter<string>(
      "burnMintTokenPoolBytecode"
    );
    const remoteTokenPools =
      m.getParameter<RemoteTokenPoolInfoSolidityParameter[]>(
        "remoteTokenPools"
      );
    const salt = m.getParameter<string>("salt");

    const futureOwner = m.getParameter<string>("futureOwner");

    const FactoryDestination = m.contractAt(
      "CCIPFactoryDestination",
      factoryDestination
    );

    const destinationParams: DestinationParams = {
      bridgedSharesUnderAgreement: bridgedSharesUnderAgreementDeploymentData,
      chainlink: chainlinkAddresses,
      burnMintTokenPoolBytecode,
      remoteTokenPools,
      salt,
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
      [destinationParams, futureOwner],
      {
        after: [FactoryDestination],
      }
    );

    const sourceWrapper = m.readEventArgument(
      deployTx,
      "DestinationBridgedSharesUnderAgreementResolved",
      "sourceWrapper"
    );
    const pool = m.readEventArgument(
      deployTx,
      "DestinationTokenPoolDeployed",
      "pool"
    );
    return {
      BridgedSharesUnderAgreement: m.contractAt(
        "BridgedSharesUnderAgreement",
        sourceWrapper
      ),
      BurnMintTokenPool: m.contractAt("BurnMintTokenPool", pool),
    };
  }
);
