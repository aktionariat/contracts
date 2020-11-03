pragma solidity 0.7.4;

contract Nonce {

    uint128 constant MAX_INCREASE = 100;
    
    uint128 public maxNonce;
    uint128 public register;
    
    constructor(){
        maxNonce = 128;
    }
    
    function execute(uint128 nonce) public {
        if (nonce > maxNonce){
            require(nonce <= maxNonce + MAX_INCREASE);
            register = register << (nonce - maxNonce);
            maxNonce = nonce;
        } else {
            require(maxNonce - 128 <= nonce && nonce < maxNonce);
            uint128 index = uint128(0x1 << (maxNonce - nonce - 1));
            require(index & register == 0x0);
            register |= index;
        }
    }
    
    function nextNonce() public view returns (uint128){
        return maxNonce + 1;
    }
    
    function isFree(uint128 nonce) public view returns (bool){
        if (nonce > maxNonce){
            return true;
        } else if (nonce == maxNonce || maxNonce > nonce + 128){
            return false;
        } else {
            uint128 index = uint128(0x1 << (maxNonce - nonce - 1));
            return index & register == 0x0;
        }
    }
    
    
}