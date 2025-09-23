import { expect } from "chai";
import { Contract } from "ethers";
import { connection } from "./TestBase.ts";
import TestModule from "../ignition/modules/TestModule.ts";

describe("MultichainSharesMaster", function () {
  let allowlistShares: Contract;
  let multichainSharesMaster: Contract;
  
  before(async function() {
    ({ allowlistShares, multichainSharesMaster } = await connection.ignition.deploy(TestModule));
  });

  it("Should deploy", async function () {
    expect(await multichainSharesMaster.getAddress()).to.exist;
  });

  it("Set wrapped token correctly", async function () {
    expect(await multichainSharesMaster.wrapped()).to.be.equal(allowlistShares);
  });
});