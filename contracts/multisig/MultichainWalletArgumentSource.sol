// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

/**
 * If this contract is deterministically deployed across chains, it can
 * be used to initialize immutables in the MultiChain wallet, yielding
 * the same addresses even if the immutables differ across chains.
 */
contract MultichainWalletArgumentSource {

    // Router
    // Mainnet: 0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D
    // Polygon: 0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe

    // See https://docs.chain.link/ccip/directory/mainnet

    address public router;

    function initialize(address router_) external {
        if (router == address(0)){
            router = router_;
        }
    }
}