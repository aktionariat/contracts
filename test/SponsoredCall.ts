import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import { setBalance } from "../scripts/helpers/setBalance.ts";
import TestModule, { TestModuleConfig } from "../ignition/modules/TestModule.ts";

describe("SponsoredCall", function () {
    
    let sponsoredCall: Contract;
    let tradeReactor: Contract;
    let zchf: Contract;

    beforeEach(async function() {
        ({ sponsoredCall, tradeReactor, zchf } = await connection.ignition.deploy(TestModule));
    });

    it("Should deploy", async function () {
        expect(await sponsoredCall.getAddress()).to.exist;
    });

    it("Should be able to delegate to a contract", async function () {
        
        const signer1AsContract = await connection.ethers.getContractAt("SponsoredCall", await signer1.getAddress());

        const functionToCall = new connection.ethers.Interface(["function approve(address spender, uint256 amount) external returns (bool)"]);
        const encodedCall = functionToCall.encodeFunctionData("approve", [await tradeReactor.getAddress(), ethers.parseUnits("1000", 18)]);
        const nonce = await signer1.getNonce()
        const auth = await signer1.authorize({address: await sponsoredCall.getAddress(), nonce: nonce});
        const contractNonce = await signer1AsContract["nonce"]({type: 4, authorizationList: [auth]});
        const digest = ethers.keccak256(ethers.solidityPacked(["uint256", "address", "uint256", "bytes"], [contractNonce, TestModuleConfig.zchfAddress, 0n, encodedCall]));
        const signature = await signer1.signMessage(ethers.getBytes(digest))

        console.log("Contract Nonce:", contractNonce);
        console.log("Digest to sign:", digest);
        console.log("Signature:", signature);

        const allowanceBefore = await zchf.allowance(signer1, await tradeReactor.getAddress());
        console.log("Allowance before:", allowanceBefore);

        await signer1AsContract.connect(deployer).execute({ to: TestModuleConfig.zchfAddress, value: 0n, data: encodedCall }, signature, { value: 0n, type: 4, authorizationList: [auth] });

        const allowanceAfter = await zchf.allowance(signer1, await tradeReactor.getAddress());
        console.log("Allowance after:", allowanceAfter);


    });

});