Deployment of the MultichainWallet stack on a chain:

1. Deploy `Rollout` through CreateX with the deployer-prefixed salt, so it lands on the same address on every chain.
2. Call `rollout(ccipRouter, link)` from the `DEPLOYER` account with the chain's CCIP router and LINK token. It deploys the argument source, the master and the factory.

Both steps go in one transaction where possible. Wallets are then created as clones through `MultichainWalletFactory`. See [doc/multisig.md](../../doc/multisig.md).
