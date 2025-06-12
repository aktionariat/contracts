// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

/**
 * If this contract is deterministically deployed across chains, it can
 * be used to initialize immutables in the MultiChain wallet, yielding
 * the same addresses even if the immutables differ across chains.
 */
contract MultichainWalletArgumentSource {

    // Deployed on 0xf6d96dD440D020022134b8d902bedC2a2249E041 on Mainnet and Polygon

    // Router
    // Mainnet: 0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D
    // Polygon: 0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe

    // LINK
    // Mainet:  0x514910771AF9Ca656af840dff83E8264EcF986CA
    // Polygon: 0xb0897686c545045aFc77CF20eC7A532E3120E0F1

    // See https://docs.chain.link/ccip/directory/mainnet

    address public router;
    address public link;

    function initialize(address router_, address link_) external {
        if (router == address(0)){
            router = router_;
        }
        if (link == address(0)) {
            link = link_;
        }
    }
}