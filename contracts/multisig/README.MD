1. Compile all with cancun, 0.8.24, no optimization
   https://remix.ethereum.org/#lang=en&optimize=false&runs=200&evmVersion=cancun&version=soljson-v0.8.24+commit.e11b9ed9.js&language=Solidity
2. Connect remix with 0xD13Cd7c1568e6923c74447c21D6440b8DBaa4593 (Aktionariat Ledger Account 3)
3. Deploy MultichainWalletArgumentSource to 0x134e63eDFc394165F5d1028CEAc82E049424A8Bb
4. Init MultichainWalletArgumentSource with correct router
5. Do dummy transaction to bump nonce.
6. Do dummy transaction to bump nonce.
7. Do dummy transaction to bump nonce.
8. Deploy MultiSigWalletMaster with 0x134e63eDFc394165F5d1028CEAc82E049424A8Bb as argument, resulting in 0xF4C4C02fe590548BA2fcC42e832Be2a25DDC6C95
9. Deploy MultiSigCloneFactory to 0x965D78eb4Db08e942Fa4E8f752452bc48199B13a
10. Test clone factory, should predict 0x8c78c0686224d0FDE37906c4A9770F45c50B23d1 with salt 0x0000000000000000000000000000000000000000000000000000000000000000