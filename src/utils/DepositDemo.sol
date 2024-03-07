// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import interface iPermit
import {ISignatureTransfer} from "../lib/ISignatureTransfer.sol";
import {Intent, IntentHash} from "../lib/IntentHash.sol";

contract DepositDemo {
  using IntentHash for Intent;

  ISignatureTransfer public immutable signatureTransfer;

  struct WitnessU {
      address user;
  }
  struct WitnessB {
      bytes data;
  }
  struct WitnessS {
      string data;
  }

  string private constant WITNESS_TYPE_STRING = "WitnessU witness)TokenPermissions(address token,uint256 amount)WitnessU(address user)";
  string private constant WITNESS_TYPE_STRING_B = "WitnessB witness)TokenPermissions(address token,uint256 amount)WitnessB(bytes data)";
  string private constant WITNESS_TYPE_STRING_S = "Witness witness)TokenPermissions(address token,uint256 amount)Witness(string data)";
  string private constant WITNESS_INTENT_TYPE_STRING = "Intent witness)Intent(address owner,address filler,address tokenOut,uint160 amountOut,address tokenIn,uint160 amountIn,uint48 expiration,uint48 nonce,bytes data)TokenPermissions(address token,uint256 amount)";

  bytes32 private WITNESS_TYPEHASH = keccak256("WitnessU(address user)");
  bytes32 private WITNESS_TYPEHASH_B = keccak256("WitnessB(bytes data)");
  bytes32 private WITNESS_TYPEHASH_S = keccak256("Witness(string data)");
  bytes32 private WITNESS_INTENT_TYPEHASH = keccak256("Intent(address owner,address filler,address tokenOut,uint160 amountOut,address tokenIn,uint160 amountIn,uint48 expiration,uint48 nonce,bytes data)");

  // account -> token -> balance
  mapping (address => mapping (address => uint256)) public tokenBalancesByUser;

  constructor(ISignatureTransfer _signatureTransfer) {
    signatureTransfer = _signatureTransfer;
  }


  function depositPermit(
      uint256 _amount,
      address _token,
      address _owner,
      address _user,
      ISignatureTransfer.PermitTransferFrom calldata _permit,
      bytes calldata _signature
  ) external {
      tokenBalancesByUser[_user][_token] += _amount;
      
      signatureTransfer.permitWitnessTransferFrom(
          _permit,
          ISignatureTransfer.SignatureTransferDetails({
              to: address(this),
              requestedAmount: _amount
          }),
          _owner,
          // witness
          keccak256(abi.encode(WITNESS_TYPEHASH,WitnessU(_user))),
          // witnessTypeString,
          WITNESS_TYPE_STRING,
          _signature
      );
  }/*
  function depositBytes(
      uint256 _amount,
      address _token,
      address _owner,
      WitnessB memory witnessB,
      ISignatureTransfer.PermitTransferFrom calldata _permit,
      bytes calldata _signature
  ) external {
      tokenBalancesByUser[_owner][_token] += _amount;

      // bytes32 _dataHash = keccak256(_data);
      
      signatureTransfer.permitWitnessTransferFrom(
          _permit,
          ISignatureTransfer.SignatureTransferDetails({
              to: address(this),
              requestedAmount: _amount
          }),
          _owner,
          // witness
          keccak256(abi.encode(WITNESS_TYPEHASH_B,keccak256(witnessB.data))),
          // witnessTypeString,
          WITNESS_TYPE_STRING_B,
          _signature
      );
  }*/


  function depositString(
      uint256 _amount,
      address _token,
      address _owner,
      string memory data,
      ISignatureTransfer.PermitTransferFrom calldata _permit,
      bytes calldata _signature
  ) external {
      tokenBalancesByUser[_owner][_token] += _amount;

      // bytes32 _dataHash = keccak256(_data);
      
      signatureTransfer.permitWitnessTransferFrom(
          _permit,
          ISignatureTransfer.SignatureTransferDetails({
              to: address(this),
              requestedAmount: _amount
          }),
          _owner,
          // witness
          keccak256(abi.encode(WITNESS_TYPEHASH_S,(WitnessS(data)))),
          // witnessTypeString,
          WITNESS_TYPE_STRING_S,
          _signature
      );
  }

  function depositIntent(
    Intent calldata sellIntent,
      ISignatureTransfer.PermitTransferFrom calldata _permit,
      bytes calldata _signature
  ) external {
      tokenBalancesByUser[sellIntent.owner][sellIntent.tokenOut] += sellIntent.amountOut;
      
      signatureTransfer.permitWitnessTransferFrom(
          _permit,
          ISignatureTransfer.SignatureTransferDetails({
              to: address(this),
              requestedAmount: sellIntent.amountOut
          }),
          sellIntent.owner,
          // witness
          sellIntent.hash(),
          // keccak256(abi.encode(WITNESS_TYPEHASH,Witness(sellIntent.owner))),
          // witnessTypeString,
          // WITNESS_TYPE_STRING,
          IntentHash.PERMIT2_INTENT_TYPE,
          _signature
      );
  }


}
