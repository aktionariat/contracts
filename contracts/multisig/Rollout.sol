pragma solidity >=0.8.0 <0.9.0;

import "./MultichainWalletArgumentSource.sol";
import "./MultichainWalletMaster.sol";
import "./MultichainWalletFactory.sol";

contract Rollout {

  bytes32 private constant _salt = bytes32(uint256(4242));

  function rollout(address cciprouter, address link) external returns (address) {
    MultichainWalletArgumentSource source = new MultichainWalletArgumentSource{salt: _salt}();
    source.initialize(cciprouter, link);
    MultichainWalletMaster master = new MultichainWalletMaster{salt: _salt}(source);
    MultichainWalletFactory factory = new MultichainWalletFactory{salt: _salt}(master);
    return address(factory);
  }

}