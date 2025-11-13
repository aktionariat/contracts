import TestModule from "../ignition/modules/TestModule.ts";
import { Contract, getAddress } from "ethers";
import { expect } from "chai";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";

interface Intent { 
  owner: string,
	filler: string,
	tokenOut: string,
	amountOut: bigint,
	tokenIn: string,
	amountIn: bigint,
	creation: bigint,
	expiration: bigint,
	data: string
}

export const buyerIntentConfig = {
  owner: signer1.address,
  amountOut: ethers.parseUnits("100", 18), // Paying 100 CHF
  amountIn: ethers.parseUnits("10", 0),    // To buy 10 shares
  validitySeconds: 3600                    // Valid for 1 hour
}

export const sellerIntentConfig = {
  owner: signer2.address,
  amountOut: ethers.parseUnits("20", 0),   // Selling 20 shares
  amountIn: ethers.parseUnits("150", 18),  // For a total of 150 CHF
  validitySeconds: 3600                    // Valid for 1 hour
}

export function getNamedStruct(intentStruct: Intent) {
  return {
    owner: intentStruct.owner,
    filler: intentStruct.filler,
    tokenOut: intentStruct.tokenOut,
    amountOut: intentStruct.amountOut,
    tokenIn: intentStruct.tokenIn,
    amountIn: intentStruct.amountIn,
    creation: intentStruct.creation,
    expiration: intentStruct.expiration,
    data: intentStruct.data
  }
}

export function getEIP712Fields(intentStruct: Intent, verifyingContract: string) {
  const domain = {
    name: 'TradeIntent',
    version: '1',
    chainId: connection.networkConfig.chainId,
    verifyingContract: verifyingContract,
    salt: ethers.keccak256(ethers.toUtf8Bytes("aktionariat"))
  };

  const types = {
    Intent: [
      { name: 'owner', type: 'address' },
      { name: 'filler', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'creation', type: 'uint256' },
      { name: 'expiration', type: 'uint256' },
      { name: 'data', type: 'bytes' }
    ]
  };

  const intent = getNamedStruct(intentStruct);

  return { domain, types, intent };
}

export function getSignature(signer: any, intentStruct: Intent, verifyingContract: string) {
  const { domain, types, intent } = getEIP712Fields(intentStruct, verifyingContract);
  return signer.signTypedData(domain, types, intent);
}

describe("Intents and Signing", function () {
  let tradeReactor: Contract;
  let secondaryMarketFactory: Contract;
  let secondaryMarket: Contract;
  let secondaryMarketWithRouter: Contract;
  let allowlistDraggableShares: Contract
  let zchf: Contract;

  before(async function() {
    ({ secondaryMarketFactory, zchf, allowlistDraggableShares, tradeReactor } = await connection.ignition.deploy(TestModule));
    const secondaryMarketAddress = await secondaryMarketFactory.predict(owner, zchf, allowlistDraggableShares, tradeReactor, ethers.ZeroAddress);
    await secondaryMarketFactory.deploy(owner, zchf, allowlistDraggableShares, tradeReactor, ethers.ZeroAddress);
    secondaryMarket = await ethers.getContractAt("SecondaryMarket", secondaryMarketAddress);
  });

  it("Should be able to get buy intent from SecondaryMarket", async function () {
    const intent: Intent = await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds);
    const latestBlockTimestamp = await connection.networkHelpers.time.latest();

    expect(intent.owner).to.equal(buyerIntentConfig.owner);
    expect(intent.filler).to.equal(await secondaryMarket.getAddress());
    expect(intent.tokenOut).to.equal(await secondaryMarket.CURRENCY());
    expect(intent.amountOut).to.equal(buyerIntentConfig.amountOut);
    expect(intent.tokenIn).to.equal(await secondaryMarket.TOKEN());
    expect(intent.amountIn).to.equal(buyerIntentConfig.amountIn);
    expect(intent.creation).to.equal(latestBlockTimestamp);
    expect(intent.expiration).to.equal(latestBlockTimestamp + buyerIntentConfig.validitySeconds);
    expect(intent.data).to.equal("0x");
  });

  it("Should be able to get sell intent from SecondaryMarket", async function () {
    const intent: Intent = await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds);
    const latestBlockTimestamp = await connection.networkHelpers.time.latest();

    expect(intent.owner).to.equal(sellerIntentConfig.owner);
    expect(intent.filler).to.equal(await secondaryMarket.getAddress());
    expect(intent.tokenOut).to.equal(await secondaryMarket.TOKEN());
    expect(intent.amountOut).to.equal(sellerIntentConfig.amountOut);
    expect(intent.tokenIn).to.equal(await secondaryMarket.CURRENCY());
    expect(intent.amountIn).to.equal(sellerIntentConfig.amountIn);
    expect(intent.creation).to.equal(latestBlockTimestamp);
    expect(intent.expiration).to.equal(latestBlockTimestamp + sellerIntentConfig.validitySeconds);
    expect(intent.data).to.equal("0x");
  });

  it("Should be able to sign a buy intent", async function () {
    const intentStruct = await secondaryMarket.createBuyOrder(buyerIntentConfig.owner, buyerIntentConfig.amountOut, buyerIntentConfig.amountIn, buyerIntentConfig.validitySeconds);
    const { domain, types, intent } = getEIP712Fields(intentStruct, await tradeReactor.getAddress());

    const signature = await signer1.signTypedData(domain, types, intent);

    await expect(secondaryMarket.verifySignature(intent, signature)).to.not.revert(ethers);
  });

  it("Should be able to sign a sell intent", async function () {
    const intentStruct = await secondaryMarket.createSellOrder(sellerIntentConfig.owner, sellerIntentConfig.amountOut, sellerIntentConfig.amountIn, sellerIntentConfig.validitySeconds);
    const { domain, types, intent } = getEIP712Fields(intentStruct, await tradeReactor.getAddress());

    const signature = await signer2.signTypedData(domain, types, intent);

    await expect(secondaryMarket.verifySignature(intent, signature)).to.not.revert(ethers);
  });
});