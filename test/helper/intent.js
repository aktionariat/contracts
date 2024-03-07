const {network, ethers,} = require("hardhat");
const { SignatureTransfer, permitTransferFromWithWitnessType } = require("@uniswap/permit2-sdk");

const SIGNATURETRANSFER_DOMAIN_NAME = 'Permit2'

class SignatureTransferIntent {
  constructor(tokenAdr, spender, amount) {
    this.permitted = {
      token: tokenAdr,
      amount: amount,
    };
    this.spender = spender;
    this.nonce = 0;
    this.deadline = Math.floor(Date.now() /  1000) +  60 *  60;
  }
  withNonce(_nonce) {
    this.nonce = _nonce
    return this;
  }
  async signIntent(signatureTransfer, signer) {
    const permitData = SignatureTransfer.getPermitData(
      this, // permit object
      await signatureTransfer.getAddress(), // permit2/signature contract
      await ethers.provider.getNetwork().then((net) => net.chainId), // chain id
      // withness data
      );
    // sign signatureTransfer
    // console.log(permitData);
    const signature  = await signer.signTypedData(permitData.domain, permitData.types, permitData.values);
    return {permitData, signature};
  }
}
/*
class MockIntent {
  constructor(token, amount) {
    this.tokenOut = token;
    this.amountOut = amount;
  }

  async signIntent(signatureTransfer, sender, signer) {
    const mockWitness = {
      witnessTypeName: 'MockWitness',
      witnessType: { MockWitness: [{ name: 'mock', type: 'uint256' }] },
      witness: { mock: '0x0000000000000000000000000000000000000000000000000000000000000000' },
    }
    const permit = new SignatureTransferIntent(this.tokenOut, sender, this.amountOut);
    const intent = SignatureTransfer.getPermitData(
      permit,
      await signatureTransfer.getAddress(), 
      await ethers.provider.getNetwork().then((net) => net.chainId), 
      mockWitness);
    const signature  = await signer.signTypedData(intent.domain, intent.types, intent.values);
    // const hash = SignatureTransfer.hash(permit, await signatureTransfer.getAddress(), await ethers.provider.getNetwork().then((net) => net.chainId), mockWitness);
    const TYPE_HASH = ethers.id("MockWitness(uint256 mock)");
    const types = ["uint256"];
    const values = ["0x0000000000000000000000000000000000000000000000000000000000000000"];
    const hash = ethers.keccak256(ethers.solidityPacked(types,values));
    return {intent, signature, hash};
  }
}*/

class TradeIntent {
  constructor(_owner, _filler, _tokenOut, _amountOut, _tokenIn, _amountIn, _nonce, _data) {
    this.owner = _owner;
    this.filler = _filler;
    this.tokenOut = _tokenOut;
    this.amountOut = _amountOut;
    this.tokenIn = _tokenIn;
    this.amountIn = _amountIn;
    this.expiration = Math.floor(Date.now() /  1000) +  60 *  60;
    this.nonce = _nonce;
    // this.data = _data;
  }
  
  async signIntent(signatureTransfer, sender, signer) {
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
          //  { name: 'data', type: 'bytes' },
         ],
      },
      witness: {
         owner: this.owner,
         filler: this.filler,
         tokenOut: this.tokenOut,
         amountOut: this.amountOut,
         tokenIn: this.tokenIn,
         amountIn: this.amountIn,
         expiration: this.expiration,
         nonce: this.nonce,
        //  data: this.data
      },
     };
    const permit = new SignatureTransferIntent(this.tokenOut, sender, this.amountOut).withNonce(this.nonce);
    const intent = SignatureTransfer.getPermitData(
      permit,
      await signatureTransfer.getAddress(), 
      await ethers.provider.getNetwork().then((net) => net.chainId), 
      witness);
      // console.log(intent);
    // const domain = signatureTransferDomain(signatureTransfer); 
    // const intentTypes = permitTransferFromWithWitnessType();
    const signature  = await signer.signTypedData(intent.domain, intent.types, intent.values);
    const hash = SignatureTransfer.hash(permit, await signatureTransfer.getAddress(), await ethers.provider.getNetwork().then((net) => net.chainId), witness);
    return {intent, signature, hash};
  }
}

async function signatureTransferDomain(signatureTransfer) {
  const domain = {
    name: SIGNATURETRANSFER_DOMAIN_NAME,
    chainId: await ethers.provider.getNetwork().then((net) => net.chainId),
    verifyingContract: await signatureTransfer.getAddress(),
  }
  return domain
}

async function buildSignatureTransferIntent(token, spender, amount) {
  const intent = new SignatureTransferIntent(await token.getAddress(), spender.address, amount);
  return intent;
}

async function signSignatureTransferIntent(permit, signatureTransfer, signer) {
  const permitData = SignatureTransfer.getPermitData(
    permit, // permit object
    await signatureTransfer.getAddress(), // permit2/signature contract
    await ethers.provider.getNetwork().then((net) => net.chainId), // chain id
    // withness data
    );
  // sign signatureTransfer
  signature  = await signer.signTypedData(permitData.domain, permitData.types, permitData.values);
  return (permitData, signature);
}

module.exports = {
  buildSignatureTransferIntent,
  signSignatureTransferIntent,
  SignatureTransferIntent,
  TradeIntent,
}