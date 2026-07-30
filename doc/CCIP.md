# Aktionariat CCIP

<!-- here motivation -->

## Architecture

<!-- Here diagram architecture and short explanation, like the drwan paper -->

<!-- Give also files and paths in codebase -->

## Actions

Here a list of actions that can be performed over the CCIP infrastructure and different tasks that we implement through tasks and our code infrastructure.

- Deploy bridge infrastructure: See `ccip-deploy` task
- Bridge tokens: See `ccip-bridge` task
- Add new destination chain for tokens: `ccip-add-destination` -> TODO
- Halt bridge: See `ccip-halt` task -> TODO

## Local Tests

## Testnet Tests

To run testnet tests we provided utilities to interact with networks, deploy tokens and manage contracts.
The following Hardhat tasks are designed for the CCIP testing infrastructure, as such the default network used are `sepolia` and `fuji`.
To change them, we provide CLI flags, custom defined for RPCs, and the common `--network` provided by Hardhat to manage the network.

To get help with an hardhat tasks, run `npx hardhat help <task-name>`.

To estimate the gas you need on source and destination network to deploy contracts:

```sh
npx hardhat ccip-estimate-deployment-gas
```

or

```sh
npx hardhat ccip-estimate-deployment-gas
	--source [source-network]
	--destination [destination-network]
```

Both `source` and `destination` are optional, if omitted they default to `sepolia` and `fuji` respectively.

To deploy contracts:

```sh
npx hardhat ccip-deploy
```

or

```sh
npx hardhat ccip-deploy
	--source [source-network]
	--destination [destination-network]
```

Same as before, both `source` and `destination` are optional, if omitted they default to `sepolia` and `fuji` respectively.
All deployment addresses should be printed to the screen.
From now on, you should see a deployment folder at `ignition/deployments/ccip-testnet-[destination-network]` and `ignition/deployments/ccip-testnet-[source-network]`.
Addtional flag for `npx hardhat deply-ccip` is the `--reset` flag, which will act the same way as the ignition `--reset` flag, to do so it eliminates both source and destination folders before initiating ignition deployment.
In the following commands if you use flag `--ccipIgnition` the scrip will read addresses from the deployment folder and you wont need to write any address for execution.

To mint some Shares, and wrap them to SharesUnderAgreement (sha):

```sh
npx hardhat mint-wrap-shares --ccipIgnition --network [source-network]
```

As said, if you deployed CCIP contracts using the ignition module, when adding the `--ccipIgnition` flag, the script will ignore any other flag and will automatically read the ignition output and execute.
Where `to` is going to be the deployer (owner) of CCIP contracts.
The flag `--network` is not needed if the default network aligns with the deployment network, if deplyed using `deploy-ccip` with no flags you need to use network flag: `--netwrok sepolia`.
Or

```sh
npx hardhat mint-wrap-shares
	--shares [shares-address]
	--sha [sha-address]
	--amount [quantity]
	--to [receiver-address]
	--network [deployed-network]
```

Fields such as `shares`, `sha` and `to` are mandatory. While `to`, `amount` and `network` are optional, if omitted the script uses the signer address as `to`, 100 as sha `amount` and op simulated as `network`, you probably want to change `network` depending on deployment.

You can find the pool address at "ChainSettingsModule#IOwnable" within the source chain ingition deployment folder
