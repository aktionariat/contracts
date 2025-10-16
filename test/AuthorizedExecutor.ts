import { expect } from "chai";
import { Contract } from "ethers";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import TestModule, { TestModuleConfig } from "../ignition/modules/TestModule.ts";
import { AuthorizedCallStruct } from "../types/ethers-contracts/EIP7702/AuthorizedCallVerifier.sol/AuthorizedCallVerifier.ts";

describe("AuthorizedExecutor", function () {
    
    let authorizedExecutor: Contract;
    let tradeReactor: Contract;
    let zchf: Contract;

    beforeEach(async function() {
        ({ authorizedExecutor, tradeReactor, zchf } = await connection.ignition.deploy(TestModule));
    });

    it("Should deploy", async function () {
        expect(await authorizedExecutor.getAddress()).to.exist;
    });

    it("Should be able to delegate to a contract", async function () {
        // Get the contract as if the AuthorizedExecutor was already on signer1's address, to be able to construct transactions        
        const signer1AsContract = await connection.ethers.getContractAt("AuthorizedExecutor", await signer1.getAddress());

        // Encode the function that we want to call, in this case setting an approval
        const functionToCall = new connection.ethers.Interface(["function approve(address spender, uint256 amount) external returns (bool)"]);
        const encodedCall = functionToCall.encodeFunctionData("approve", [await tradeReactor.getAddress(), ethers.parseUnits("1000", 18)]);

        // Get the actual nonce of the account. This is needed to sign the authorization.
        // Then, create and sign the authorization to be used afterwards.
        const authorizedAddress = await authorizedExecutor.getAddress();
        const nonce = await signer1.getNonce();
        const auth = await signer1.authorize({address: authorizedAddress, nonce: nonce});
        

        // Get the "contractNonce" on the contract for replay protection. It is part of what is signed.
        // Note that the address still has not delegated to the contract at this point, so has no code.
        // We can't just check if the address is already delegated (and to our contract), and assume 0 nonce otherwise,
        // because delegations can be changed and we may be delegating back to AuthorizedExecutor with non-zero nonce stored in that context.
        // So we are making a view call and still passing the authorization, and as crazy as it sounds, this works.
        const contractNonce = await signer1AsContract["nonce"]({type: 4, authorizationList: [auth]});

        // Signing the AuthorizedCall for what we want to call
        const authorizedCall: AuthorizedCallStruct = {nonce: contractNonce, to: TestModuleConfig.zchfAddress, functionSignature: "approve(address,uint256)", value: 0n, data: encodedCall };
        const signature = await getSignature(signer1, authorizedCall, signer1.address)
        
        // Store initial state for comparison
        const allowanceBefore = await zchf.allowance(signer1, await tradeReactor.getAddress());

        // Execute the call by calling AuthorizedExecutor.execute with the call object and the signature
        // Also passing the type 4 (EIP-7702) and the signed authorization
        // At this point, the signer address is actually being delegated to AuthorizedExecutor and then execute is being called on it.
        // Note that the caller is "deployer", which is arbitrary and could be anyone.
        await signer1AsContract.connect(deployer).execute(authorizedCall, signature, { value: 0n, type: 4, authorizationList: [auth] });

        // Let's see what the allowance is afterwards
        const allowanceAfter = await zchf.allowance(signer1, await tradeReactor.getAddress());

        // YAY!
        expect(allowanceAfter).to.equal(allowanceBefore + ethers.parseUnits("1000", 18));
    });
});

export function getEIP712Fields(call: AuthorizedCallStruct, verifyingContract: string) {
  const domain = {
    name: 'AuthorizedCall',
    version: '1',
    chainId: connection.networkConfig.chainId,
    verifyingContract: verifyingContract,
    salt: ethers.keccak256(ethers.toUtf8Bytes("aktionariat"))
  };

  const types = {
    AuthorizedCall: [
      { name: 'nonce', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'functionSignature', type: 'string' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' }
    ]
  };

  const message = call;

  return { domain, types, message };
}

export function getSignature(signer: any, call: AuthorizedCallStruct, verifyingContract: string) {
  const { domain, types, message } = getEIP712Fields(call, verifyingContract);
  return signer.signTypedData(domain, types, message);
}