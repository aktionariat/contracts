pragma solidity >=0.8.0 <0.9.0;

import "./MultichainWalletArgumentSource.sol";
import "./MultiSigWalletMaster.sol";
import "./MultiSigCloneFactory.sol";

contract Rollout {

  bytes32 private constant _salt = bytes32(uint256(42));

  function rollout(address cciprouter) external returns (address) {
    MultichainWalletArgumentSource source = new MultichainWalletArgumentSource{salt: _salt}();
    source.initialize(cciprouter);
    MultiSigWalletMaster master = new MultiSigWalletMaster{salt: _salt}(IArgumentSource(address(source)));
    MultiSigCloneFactory factory = new MultiSigCloneFactory{salt: _salt}(address(master));
    return address(factory);
  }

}