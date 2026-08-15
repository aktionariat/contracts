// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

/**
 * If this contract is deterministically deployed across chains, it can
 * be used to initialize immutables in the MultiChain wallet, yielding
 * the same addresses even if the immutables differ across chains.
 */

contract MultichainWalletArgumentSource {

    // Router
    // Mainnet  : 0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D
    // Optimism : 0x3206695CaE29952f4b0c22a169725a865bc8Ce0f
    // Polygon  : 0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe

    // LINK (CCIP fee token)
    // Mainnet  : 0x514910771AF9Ca656af840dff83E8264EcF986CA
    // Optimism : 0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6
    // Polygon  : 0xb0897686c545045aFc77CF20eC7A532E3120E0F1
    // Careful: Polygon has two LINK tokens. CCIP only accepts the native ERC677 one above.

    address public router;
    address public link;

    function initialize(address router_, address link_) external {
        if (router == address(0)){
            router = router_;
            link = link_;
        }
    }
}