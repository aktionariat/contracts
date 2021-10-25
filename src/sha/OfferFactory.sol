/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2020 Aktionariat AG (aktionariat.com)
*
* Permission is hereby granted to any person obtaining a copy of this software
* and associated documentation files (the "Software"), to deal in the Software
* without restriction, including without limitation the rights to use, copy,
* modify, merge, publish, distribute, sublicense, and/or sell copies of the
* Software, and to permit persons to whom the Software is furnished to do so,
* subject to the following conditions:
*
* - The above copyright notice and this permission notice shall be included in
*   all copies or substantial portions of the Software.
* - All automated license fee payments integrated into this and related Software
*   are preserved.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/
pragma solidity >=0.8;

import "./Offer.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract OfferFactory {

    address public offerImplementation;
    
    event OfferCreated(address contractAddress, string typeName);

    constructor(address _offerImplementation) {
        offerImplementation = _offerImplementation;
    }


    // It must be possible to predict the address of the offer so one can pre-fund the allowance.
    function predict(bytes32 salt, address buyer, address token, uint256 pricePerShare, address currency, uint256 quorum, uint256 votePeriod) public view returns (address) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(type(Offer).creationCode, abi.encode(buyer, token, pricePerShare, currency, quorum, votePeriod)));
        bytes32 hashResult = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash));
        return address(uint160(uint256(hashResult)));
        
        /* bytes32 hashResult = generateSalt(salt, buyer, token, pricePerShare, currency, quorum, votePeriod);
        return Clones.predictDeterministicAddress(offerImplementation, hashResult); */
    }

    // Do not call directly, msg.sender must be the token to be acquired
    // TODO: deploy proxy
    function create(bytes32 salt, address buyer, uint256 pricePerShare, address currency, uint256 quorum, uint256 votePeriod) public payable returns (address) {
        Offer offer = new Offer{value: msg.value, salt: salt}(buyer, msg.sender, pricePerShare, currency, quorum, votePeriod);
        return address(offer);
        /* bytes32 resultSalt = generateSalt(salt, buyer, msg.sender, pricePerShare, currency, quorum, votePeriod);
        address payable instance = payable(Clones.cloneDeterministic(offerImplementation, resultSalt));
        Offer(instance).initialize{value:msg.value}(buyer, msg.sender, pricePerShare, currency, quorum, votePeriod);
        emit OfferCreated(instance, "Offer");
        return instance; */
    }

    function generateSalt(bytes32 salt, address buyer, address token, uint256 pricePerShare, address currency, uint256 quorum, uint256 votePeriod) pure internal returns (bytes32){
        bytes32 initCodeHash = keccak256(abi.encodePacked(type(Offer).creationCode, abi.encode(buyer, token, pricePerShare, currency, quorum, votePeriod)));
        bytes32 hashResult = keccak256(abi.encodePacked(bytes1(0xff), salt, initCodeHash));
        return hashResult;
    }

}