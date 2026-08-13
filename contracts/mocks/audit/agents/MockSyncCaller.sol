// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// Calls MultichainWallet.sync with forwarded value. Deliberately has NO
// receive()/fallback(), so the wallet's overpaid-fee refund .call fails.
contract MockSyncCaller {
    function callSync(address wallet, uint64 chain, address signer) external payable {
        (bool ok, ) = wallet.call{value: msg.value}(
            abi.encodeWithSignature("sync(uint64,address)", chain, signer)
        );
        require(ok, "sync failed");
    }
}
