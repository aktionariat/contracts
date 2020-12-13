pragma solidity >=0.4.25 <0.7.0;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/SafeMath.sol";

contract TestSafeMath {

  using SafeMath for uint256;

  function testAdd() public {

    uint one = 1;
    uint two = 2;

    uint expected = 3;

    Assert.equal(one.add(two), expected, "1+2=3");
  }

  // TODO: test the relevant part, the overflow handling...

}
