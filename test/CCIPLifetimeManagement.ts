/**
 * Local tests for the CCIP infrastructure and realted Aktionariat contracts for
 * lifetime logic, which comprehends Drag-Along, Migration, Cancellation and Recovery.
 * It uses packages:
 *
 * "@chainlink/contracts-ccip": "^1.6.3",
 * "@chainlink/local": "^0.2.9",
 *
 * Note that the last released CCIP package of v2.0.0 is incompatible with the
 * latest @chainlink/local release, as such we reverted to use the last non-breaking
 * ccip release namely, v1.6.3.
 *
 * Even if documents for local simulator (https://docs.chain.link/chainlink-local/build/ccip/hardhat/local-simulator)
 * show to use v0.2.7-beta and for ccip (https://docs.chain.link/ccip/api-reference/evm/v1.6.1)
 * they say latest v1.6.1. The testing suite from chainlink is probably not up
 * to date.
 *
 * Along with local testing we aim to provide also live testnet tests. To ensure
 * that code is functioning correctly, since Chainlink Local does simulate the
 * source and destination infrastructure on a single chain. Testnet tests will
 * mimic current local tests. Tests have to be run manually, they are supported
 * by utils within `tasks`, see `docs/CCIP.md` for more information about implemented
 * tasks.
 */
