module.exports = {
  skipFiles: [
    'multisig/MultiSigWallet.sol', //old version
    'multisig/MultiSigWalletV2.sol',//tested in backend
    'multisig/Nonce.sol', //part of multisig that is tested in backend
    'multisig/RLPEncode.sol', //part of multisig that is tested in backend
    'utils/Address.sol'
   ]
};