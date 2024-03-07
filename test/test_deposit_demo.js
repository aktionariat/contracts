const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { SignatureTransfer, PermitTransferFrom, PERMIT2_ADDRESS} = require("@uniswap/permit2-sdk");

describe("TestDemo", () => {
  let permit2;
  let demo;
  let erc20;

  let sig1;
  let sig2;

  let amount;


  before(async () => {
    amount = 10;

    await deployments.fixture([
      "Shares",
      "SignatureTransfer",,
      "DepositDemo",
    ]);

    erc20 = await ethers.getContract("Shares");
    demo = await ethers.getContract("DepositDemo");
    permit2 = await ethers.getContract("SignatureTransfer");

    [sig1, sig2] = await ethers.getSigners();

    await erc20.connect(sig2).mint(sig1.address, 1000);
    await erc20.connect(sig1).approve(await permit2.getAddress(), ethers.MaxUint256); // approve max
    await erc20.connect(sig2).mint(sig2.address, 1000);
    await erc20.connect(sig2).approve(await permit2.getAddress(), ethers.MaxUint256); // approve max

  });

  it.skip("Should deposit", async() => {
    const permit = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
      },
      spender: await demo.getAddress(),
      nonce: 11,
      deadline: ethers.MaxUint256
    };

    const witness = {
        witnessTypeName: 'Witness',
        witnessType: { Witness: [{ name: 'user', type: 'address' }] },
        witness: { user: sig1.address },
      }
    const { domain, types, values } = SignatureTransfer.getPermitData(permit, await permit2.getAddress(), 1, witness);
    // console.log(domain);
    // console.log(values);
    // console.log(types);
    console.log(await erc20.balanceOf(sig1.address));
    let signature = await sig1.signTypedData(domain, types, values);
    await demo.connect(sig2).depositPermit(amount, await erc20.getAddress(), sig1.address, sig1.address, permit, signature);
  })

  it("Should deposit no sdk", async() => {
    const types = {
      PermitWitnessTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'witness', type: 'WitnessU' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      WitnessU: [{ name: 'user', type: 'address' }] 
    }
    const values = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
        },
      spender: await demo.getAddress(),
      nonce: 12,
      deadline: ethers.MaxUint256,
      witness: {
        user: sig1.address
      }
    }
    const domain = {
      name: 'Permit2',
      chainId: 1,
      verifyingContract: await permit2.getAddress()
    }
    // const { domain, types, values } = SignatureTransfer.getPermitData(permit, await permit2.getAddress(), 1, witness);
    // console.log(domain);
    console.log(values);
    console.log(types);
    let signature = await sig1.signTypedData(domain, types, values);
    const permit = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
      },
      nonce: 12,
      deadline: ethers.MaxUint256
    };
    await demo.connect(sig2).depositPermit(amount, await erc20.getAddress(), sig1.address, sig1.address, permit, signature);
  })

  it.skip("Should deposit bytes", async() => {
    const permit = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
      },
      spender: await demo.getAddress(),
      nonce: 11,
      deadline: ethers.MaxUint256
    };

    const witness = {
        witnessTypeName: 'Witness',
        witnessType: { Witness: [{ name: 'data', type: 'bytes' }] },
        witness: { data: ethers.keccak256(ethers.toUtf8Bytes("0x01")) },
      }
    const { domain, types, values } = SignatureTransfer.getPermitData(permit, await permit2.getAddress(), 1, witness);
    // console.log(domain);
    let signature = await sig1.signTypedData(domain, types, values);
    await demo.connect(sig2).depositPermit(amount, await erc20.getAddress(), sig1.address, sig1.address, permit, signature);
  })

  it("Should deposit bytes no sdk", async() => {
    const types = {
      PermitBatchWitnessTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'witness', type: 'WitnessB' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      WitnessB: [{ name: 'data', type: 'bytes' }] 
    }
    const values = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
        },
      spender: await demo.getAddress(),
      nonce: 13,
      deadline: ethers.MaxUint256,
      witness: {
        data: ethers.keccak256("0x01")
        // data: "0x01"
        // data: ethers.keccak256(ethers.toUtf8Bytes("0x01"))
      }
    }
    const domain = {
      name: 'Permit2',
      chainId: 1,
      verifyingContract: await permit2.getAddress()
    }
    // console.log(domain);
    console.log(values);
    console.log(types);
    let signature = await sig1.signTypedData(domain, types, values);
    const permit = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
      },
      nonce: 13,
      deadline: ethers.MaxUint256
    };
    const witnessB = {data: "0x01"}
    await demo.connect(sig2).depositBytes(amount, await erc20.getAddress(), sig1.address, witnessB, permit, signature);
  })

  it("Should deposit string no sdk", async() => {
    const types = {
      PermitBatchWitnessTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'witness', type: 'Witness' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      Witness: [{ name: 'data', type: 'string' }] 
    }
    const values = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
        },
      spender: await demo.getAddress(),
      nonce: 14,
      deadline: ethers.MaxUint256,
      witness: {
        data: ""
        // data: "0x01"
        // data: ethers.keccak256(ethers.toUtf8Bytes("0x01"))
      }
    }
    const domain = {
      name: 'Permit2',
      chainId: 1,
      verifyingContract: await permit2.getAddress()
    }
    // console.log(domain);
    console.log(values);
    console.log(types);
    let signature = await sig1.signTypedData(domain, types, values);
    const permit = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
      },
      nonce: 13,
      deadline: ethers.MaxUint256
    };
    const witness = {data: ethers.id("")}
    // const witnessS = {data: ethers.id("test")}
    console.log("test");
    await demo.connect(sig2).depositString(amount, await erc20.getAddress(), sig1.address, "", permit, signature);
  })

  it.skip("Should deposit intent", async() => {
    const permit = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
      },
      spender: await demo.getAddress(),
      nonce: 11,
      deadline: Math.floor(Date.now() /  1000) +  60 *  60
    };

    const witness = {
      witnessTypeName: 'Intent',
      witnessType: {
        Intent: [
           { name: 'owner', type: 'address' },
           { name: 'filler', type: 'address' },
           { name: 'tokenOut', type: 'address' },
           { name: 'amountOut', type: 'uint160' },
           { name: 'tokenIn', type: 'address' },
           { name: 'amountIn', type: 'uint160' },
           { name: 'expiration', type: 'uint48' },
           { name: 'nonce', type: 'uint48' },
           { name: 'data', type: 'bytes' },
         ],
      },
      witness: {
        owner: sig1.address,
        filler: await demo.getAddress(),
        tokenOut: await erc20.getAddress(),
        amountOut: amount,
        tokenIn: await erc20.getAddress(),
        amountIn: amount,
        expiration: Math.floor(Date.now() /  1000) +  60 *  60,
        nonce: 11,
        data: ethers.keccak256("0x01")
      },
     };
    const sellIntent = {
      owner: sig1.address,
      filler: await demo.getAddress(),
      tokenOut: await erc20.getAddress(),
      amountOut: amount,
      tokenIn: await erc20.getAddress(),
      amountIn: amount,
      expiration: Math.floor(Date.now() /  1000) +  60 *  60,
      nonce: 11,
      data: ethers.keccak256("0x01")
    }
    const { domain, types, values } = SignatureTransfer.getPermitData(permit, await permit2.getAddress(), 1, witness);
    console.log(values);
    console.log(types);
    let signature = await sig1.signTypedData(domain, types, values);
    await demo.connect(sig2).depositIntent(
      sellIntent, 
      permit, 
      signature
      );
  })

  it.skip("Should deposit intent flat", async() => {

    types = {
      PermitBatchWitnessTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions[]' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'witness', type: witness.witnessTypeName },
      ],
      TokenPermissions: TOKEN_PERMISSIONS,
      Intent: [
        { name: 'owner', type: 'address' },
        { name: 'filler', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'amountOut', type: 'uint160' },
        { name: 'tokenIn', type: 'address' },
        { name: 'amountIn', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' },
        { name: 'data', type: 'bytes' },
      ],
    }
    const permit = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
      },
      spender: await demo.getAddress(),
      nonce: 11,
      deadline: Math.floor(Date.now() /  1000) +  60 *  60
    };

    const witness = {
      witnessTypeName: 'Intent',
      witnessType: {
        Intent: [
           { name: 'owner', type: 'address' },
           { name: 'filler', type: 'address' },
           { name: 'tokenOut', type: 'address' },
           { name: 'amountOut', type: 'uint160' },
           { name: 'tokenIn', type: 'address' },
           { name: 'amountIn', type: 'uint160' },
           { name: 'expiration', type: 'uint48' },
           { name: 'nonce', type: 'uint48' },
           { name: 'data', type: 'bytes' },
         ],
      },
      witness: {
        owner: sig1.address,
        filler: await demo.getAddress(),
        tokenOut: await erc20.getAddress(),
        amountOut: amount,
        tokenIn: await erc20.getAddress(),
        amountIn: amount,
        expiration: Math.floor(Date.now() /  1000) +  60 *  60,
        nonce: 11,
        data: ethers.keccak256("0x01")
      },
     };
    const sellIntent = {
      owner: sig1.address,
      filler: await demo.getAddress(),
      tokenOut: await erc20.getAddress(),
      amountOut: amount,
      tokenIn: await erc20.getAddress(),
      amountIn: amount,
      expiration: Math.floor(Date.now() /  1000) +  60 *  60,
      nonce: 11,
      data: ethers.keccak256("0x01")
    }
    const { domain, types, values } = SignatureTransfer.getPermitData(permit, await permit2.getAddress(), 1, witness);
    console.log(values);
    let signature = await sig1.signTypedData(domain, types, values);
    await demo.connect(sig2).depositIntent(
      sellIntent, 
      permit, 
      signature
      );
  })


  it.skip("Should transfer direct", async() => {
    const transferDetails = {
      to: await demo.getAddress(),
      requestedAmount:  amount,
    };

    const permit = {
      permitted: {
          token: await erc20.getAddress(),
          amount: amount
      },
      spender: await demo.getAddress(),
      nonce: 12,
      deadline: ethers.MaxUint256
    };

    const witness = {
        witnessTypeName: 'Witness',
        witnessType: { Witness: [{ name: 'user', type: 'address' }] },
        witness: { user: sig1.address },
      }
    const { domain, types, values } = SignatureTransfer.getPermitData(permit, await permit2.getAddress(), 1, witness);
    let signature = await sig1.signTypedData(domain, types, values);
    const witnessTypeString = "Witness witness)TokenPermissions(address token,uint256 amount)Witness(address user)";
    // const TYPE_HASH = ethers.id("MockWitness(uint256 mock)");
    const t = ["address"];
    const v = [sig1.address];
    const hash = ethers.keccak256(ethers.solidityPacked(t,v));
    await permit2.connect(sig2).permitWitnessTransferFrom(
      permit, // permit
      transferDetails, // transferDetails
      sig1.address, // owner
      hash, // witness
      witnessTypeString, // witnessTypeString
      signature // signature
      );
  })

});