/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { IL2StandardERC20 } from "@eth-optimism/contracts/standards/IL2StandardERC20.sol";


contract SimpleCryptoFranc is IL2StandardERC20, ERC20, Ownable {
    address public l1Token;
    address public l2Bridge;

    string constant public version = "1.0.0.0";

    // EVENTS
    event ChangeL2Bridge(address indexed from, address indexed to);
    event ChangeL1Token(address indexed from, address indexed to);

    // CONSTRUCTORS

    constructor(
        address _l2Bridge,
        address _l1Token
    ) ERC20("CryptoFranc", "XCHF") {
        l1Token = _l1Token;
        l2Bridge = _l2Bridge;
    }

    modifier onlyL2Bridge() {
        require(msg.sender == l2Bridge, "Only L2 Bridge can mint and burn");
        _;
    }

    // slither-disable-next-line external-function
    function supportsInterface(bytes4 _interfaceId) public pure returns (bool) {
        bytes4 firstSupportedInterface = bytes4(keccak256("supportsInterface(bytes4)")); // ERC165
        bytes4 secondSupportedInterface = IL2StandardERC20.l1Token.selector ^
            IL2StandardERC20.mint.selector ^
            IL2StandardERC20.burn.selector;
        return _interfaceId == firstSupportedInterface || _interfaceId == secondSupportedInterface;
    }

    function setL2Bridge(address _l2Bridge) external onlyOwner {
        emit ChangeL2Bridge(l2Bridge, _l2Bridge);
        l2Bridge = _l2Bridge;
    }

    function setL1Token(address _l1Token) external onlyOwner {
        emit ChangeL1Token(l1Token, _l1Token);
        l1Token = _l1Token;
    }

    // slither-disable-next-line external-function
    function mint(address _to, uint256 _amount) public virtual onlyL2Bridge {
        _mint(_to, _amount);

        emit Mint(_to, _amount);
    }

    // slither-disable-next-line external-function
    function burn(address _from, uint256 _amount) public virtual onlyL2Bridge {
        _burn(_from, _amount);

        emit Burn(_from, _amount);
    }


    /*
        Helper FUNCTIONS
    */

    /// @dev helper function to return foreign tokens accidental send to contract address
    /// @param _tokenaddress Address of foreign ERC20 contract
    /// @param _to Address to send foreign tokens to
    function refundForeignTokens(address _tokenaddress,address _to) public onlyOwner {
        IERC20 token = IERC20(_tokenaddress);
        // transfer current balance for this contract to _to  in token contract
        token.transfer(_to, token.balanceOf(address(this)));
    }
}