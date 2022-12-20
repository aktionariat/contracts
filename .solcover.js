module.exports = {
  skipFiles: [
    'multisig/MultiSigWallet.sol', //old version
    'multisig/MultiSigWalletV2.sol',//old version
    'multisig/Nonce.sol', //part of multisig that is tested in backend
    'multisig/RLPEncode.sol', //part of multisig that is tested in backend
    'multisig/Forwarder.sol', // coverage has problem with fallback
    'utils/Address.sol',
    'employee/EmployeeShares.sol' // not in use 
   ]
};