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
        // Get the contract as if the SponsoredCall was already on signer1's address, to be able to construct transactions        
        const signer1AsContract = await connection.ethers.getContractAt("SponsoredCall", await signer1.getAddress());

        // Encode the function that we want to call, in this case setting an approval
        const functionToCall = new connection.ethers.Interface(["function approve(address spender, uint256 amount) external returns (bool)"]);
        const encodedCall = functionToCall.encodeFunctionData("approve", [await tradeReactor.getAddress(), ethers.parseUnits("1000", 18)]);

        // Get the actual nonce of the account. This is needed to sign the authorization.
        // Then, create and sign the authorization to be used afterwards.
        const authorizedAddress = await sponsoredCall.getAddress();
        const nonce = await signer1.getNonce();
        const auth = await signer1.authorize({address: authorizedAddress, nonce: nonce});

        // Get the "contractNonce" on the contract for replay protection. It is part of what is signed.
        // Note that the address still has not delegated to the contract at this point, so has no code.
        // We can't just check if the address is already delegated (and to our contract), and assume 0 nonce otherwise,
        // because delegations can be changed and we may be delegating back to SponsoredCall with non-zero nonce stored in that context.
        // So we are making a view call and still passing the authorization, and as crazy as it sounds, this works.
        const contractNonce = await signer1AsContract["nonce"]({type: 4, authorizationList: [auth]});

        // Signing a digest containing nonce, to, value and data
        // which will be checked by the SponsoredCall contract when executing
        const digest = ethers.keccak256(ethers.solidityPacked(["uint256", "address", "uint256", "bytes"], [contractNonce, TestModuleConfig.zchfAddress, 0n, encodedCall]));
        const signature = await signer1.signMessage(ethers.getBytes(digest))
        
        // Store initial state for comparison
        const allowanceBefore = await zchf.allowance(signer1, await tradeReactor.getAddress());

        // Execute the call by calling SponsoredCall.execute with the call object and the signature
        // Also passing the type 4 (EIP-7702) and the signed authorization
        // At this point, the signer address is actually being delegated to SponsoredCall and then execute is being called on it.
        // Note that the caller is "deployer", which is arbitrary and could be anyone.
        await signer1AsContract.connect(deployer).execute({ to: TestModuleConfig.zchfAddress, value: 0n, data: encodedCall }, signature, { value: 0n, type: 4, authorizationList: [auth] });

        // Let's see what the allowance is afterwards
        const allowanceAfter = await zchf.allowance(signer1, await tradeReactor.getAddress());

        // YAY!
        expect(allowanceAfter).to.equal(allowanceBefore + ethers.parseUnits("1000", 18));
    });

});