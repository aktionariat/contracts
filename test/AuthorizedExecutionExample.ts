import { expect } from "chai";
import { connection, deployer, ethers, owner, provider, signer1, signer2, signer3, signer4, signer5 } from "./TestBase.ts";
import { AuthorizedCallStruct } from "../types/ethers-contracts/EIP7702/AuthorizedCallVerifier.sol/AuthorizedCallVerifier.ts";
import { AuthorizedExecutor, IERC20 } from "../types/ethers-contracts/index.ts";
import { getStorageAt } from "../scripts/helpers/setBalance.ts";
import { getEIP712Fields } from "./AuthorizedExecutor.ts";

describe("AuthorizedExecutor", function () {
    
    let authorizedExecutor: AuthorizedExecutor;
    let zchf: IERC20;
    let delegatedEOASignerAsContract: AuthorizedExecutor;

    const delegatedEOASigner = signer1;
    const sponsoringSigner = signer2;

    let authorizedExecutorAddress = "0x438f67c2Aa7FF150352295dCb190c19FB6672Ad5";
    let tradeReactorAddress = "0x4a67f44F48a887910525Dc8004ce804b99BC27cA";
    let zchfAddress = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";

    before(async function() {
      authorizedExecutor = await ethers.getContractAt("AuthorizedExecutor", authorizedExecutorAddress);
      zchf = await ethers.getContractAt("contracts/ERC20/IERC20.sol:IERC20", zchfAddress);
      delegatedEOASignerAsContract = await ethers.getContractAt("AuthorizedExecutor", delegatedEOASigner.address);

      // Reset the allowance to zero first
      await zchf.connect(delegatedEOASigner).approve(tradeReactorAddress, 0n);
    });

    it("Should be able to execute an authorized call to an already delegated account", async function () {
      const delegatedEOASignerNonce = await delegatedEOASigner.getNonce();

      const contractNonce = await getStorageAt(delegatedEOASigner.address, "0xC41B33CE27B56A9D89A458CFC"); // assuming nonce is stored at slot 0

      const functionToCall = new connection.ethers.Interface(["function approve(address spender, uint256 amount) external returns (bool)"]);
      const encodedCall = functionToCall.encodeFunctionData("approve", [tradeReactorAddress, ethers.parseUnits("115792089237316195423570985008687907853269984665640564039457584007913129639935", 0)]);
      
      const authorizedCall: AuthorizedCallStruct = {
        nonce: BigInt(contractNonce), 
        to: zchfAddress, 
        functionSignature: "approve(address,uint256)", 
        value: 0n, 
        data: encodedCall 
      };

      const { domain, types, message } = getEIP712Fields(authorizedCall, delegatedEOASigner.address);
      let signature = await delegatedEOASigner.signTypedData(domain, types, message);

      const auth = await delegatedEOASigner.authorize({address: authorizedExecutorAddress, nonce: delegatedEOASignerNonce});
   
      const allowanceBefore = await zchf.allowance(delegatedEOASigner.address, tradeReactorAddress);
      expect(allowanceBefore).to.equal(0n);

      await delegatedEOASignerAsContract.connect(sponsoringSigner).execute(authorizedCall, signature, { value: 0n, type: 4, authorizationList: [auth] });

      const allowanceAfter = await zchf.allowance(delegatedEOASigner.address, tradeReactorAddress);
      expect(allowanceAfter).to.equal(ethers.parseUnits("115792089237316195423570985008687907853269984665640564039457584007913129639935", 0));
    });

});
