# Deployment

The deployment is handled through factories, `FactoryDestination.sol` and `FactorySource.sol` within the `contracts/factories` folder.
The flow can be described by the following chart:

```mermaid
flowchart TB

subgraph SourceChain["Source Chain"]
    direction TB

    SourceEOA[👤 EOA]
    RealUnitMultisig[👤 RealUnitMultisig]
    AktDeployer[👤 Akt Deployer]

    subgraph SourceLogics["Logics"]
        SourceSharesLogic[Share Logics]
        SourceSHALogic[SHA Logic]
        SourcePoolLogic[LockReleaseTokenPool Logic]
    end

    subgraph Factory["Factory"]
        FactorySource[Factory Source]
    end

    subgraph SourceContracts["Contracts"]
        subgraph RealUnit["RealUnit"]
            SourceShares[RU Shares Proxy]
            SourceSHA[RU SHA Proxy]
            SourcePool[RU LockReleaseTokenPool Proxy]
        end
    end

    CCIPInfra[Chainlink CCIP Infrastructure]

    AktDeployer -->|deployed| SourceLogics
    AktDeployer -->|deployed| Factory

    AktDeployer --> FactorySource
    FactorySource -->|Factory.deploy| RealUnit
    RealUnit -.->|"Factory.deploy: ownership transfer"| RealUnitMultisig
    RealUnit -.->|"Factory.deploy: CCIP setup"| CCIPInfra

    SourceContracts <-.->|Delegate Call| SourceLogics
    SourceEOA -->|interacts| SourceContracts

    %% Pass through Chainlink Network
    CCIPInfra <--> ChainlinkEntry
end

subgraph Bridge["Chainlink Network"]
    direction LR

    ChainlinkEntry(( ))
    ChainlinkExit(( ))

    ChainlinkEntry <--> ChainlinkExit
end


subgraph DestinationChain["Destination Chain"]
    direction TB

    DestinationEOA[👤 EOA]
    DestinationRealUnitMultisig[👤 RealUnitMultisig]
    DestinationAktDeployer[👤 Akt Deployer]

    subgraph DestinationLogics["Logics"]
        DestinationBridgedSHALogic[BirdgedSHA Logic]
        DestinationPoolLogic[BurnMintTokenPool Logic]
    end

    subgraph DestinationFactory["Factory"]
        FactoryDestination[Factory Destination]
    end

    subgraph DestinationContracts["Contracts"]
        subgraph DestinationRealUnit["Destination RealUnit"]
            DestinationSHA[RU Bridged SHA Proxy]
            DestinationPool[RU BurnMintTokenPool Proxy]
        end
    end

    DestinationCCIPInfra[Chainlink CCIP Infrastructure]

    DestinationAktDeployer -->|deployed| DestinationLogics
    DestinationAktDeployer -->|deployed| DestinationFactory

    DestinationAktDeployer --> FactoryDestination
    FactoryDestination -->|Factory.deploy| DestinationRealUnit
    DestinationRealUnit -.->|"Factory.deploy: ownership transfer"| DestinationRealUnitMultisig
    DestinationRealUnit -.->|"Factory.deploy: CCIP setup"| DestinationCCIPInfra

    DestinationContracts <-.->|Delegate Call| DestinationLogics
    DestinationEOA -->|interacts| DestinationContracts

    %% Pass through Chainlink Network
    DestinationCCIPInfra <--> ChainlinkExit
end

style ChainlinkEntry fill:none,stroke:none
style ChainlinkExit fill:none,stroke:none
```

## Deployment Flow

The flow is as is:

1. The Aktionariat Deployer has to deploy all contracts' logics used by proxies.
2. The Aktionariat Deployer has to deploy the factory
   2.1. The Aktionariat calls `deploy` with token informations
   2.2. Factory deploys Proxies for tokens and CCIP Token Pool.
   2.3. Connects connects to the CCIP infrastructure.
   2.4. Transfer ownership of Proxies to a designed `futureOwner`.

Steps 1 and 2 have to be performed only once, each chain, then the deployment consits of calling the `deploy` function on source and any desired destination chain.
