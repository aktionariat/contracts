/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.37;

import "./MultichainWalletArgumentSource.sol";
import "./MultichainWalletMaster.sol";
import "./MultichainWalletFactory.sol";

/**
 * Deploys the MultichainWallet stack (argument source, master, factory) at the same addresses on
 * every chain. The Rollout itself is deployed through CreateX with a deployer-prefixed salt, so
 * only DEPLOYER can place it at its address, and rollout() is restricted to DEPLOYER as well so
 * that nobody can front-run the per-chain router and LINK arguments between the two transactions.
 * The router and LINK addresses only live in the argument source's storage and do not affect
 * any address derivation.
 */
contract Rollout {

  bytes32 private constant _salt = bytes32(uint256(4242));

  /// The only account allowed to call rollout(). Aktionariat's deployment account.
  address public constant DEPLOYER = 0x39E5351E6CE3c4B19B8b0a2F5C82c511782457BE;

  /// rollout() was called by an account other than DEPLOYER.
  /// @param sender The rejected caller.
  error Rollout_Unauthorized(address sender);

  function rollout(address cciprouter, address link) external returns (address) {
    if (msg.sender != DEPLOYER) revert Rollout_Unauthorized(msg.sender);
    MultichainWalletArgumentSource source = new MultichainWalletArgumentSource{salt: _salt}();
    source.initialize(cciprouter, link);
    MultichainWalletMaster master = new MultichainWalletMaster{salt: _salt}(source);
    MultichainWalletFactory factory = new MultichainWalletFactory{salt: _salt}(master);
    return address(factory);
  }

}
