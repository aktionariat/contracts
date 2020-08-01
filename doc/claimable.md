# Claim Mechanism

TODO: improve, move too technical parts into source code as code comment and add nice screenshots of the app and the like.

It is desirable that share tokens (which legally represent the company's equity) don't get 'lost' if a shareholder loses the private key to their account. While some token issuers address this by adding a back-door to the smart contract that gives them full control over all tokens, we prefer following a decentralized approach as recommended by the Swiss Blockchain Federation in their [Security Token Circular](http://blockchainfederation.ch/wp-content/uploads/2019/12/SBF-Circular-2019-01-Tokenized-Equity-4.pdf). Our decentralized approach allows anyone to reclaim their shares without having to rely on a centralized authority. This document describes how it works in more detail.

The standard claim process works as follows: Let us assume that Alice has lost the key to her address A. She picks a new address B and makes all calls from the new address.

1. Alice calls the function `prepareClaim`. As an argument she provides the hash of the concatenation of a user chosen nonce, her new address B and her lost address A.
2. After waiting for 24 hours, she has a 24 hour window to call `declareLost`. This function accepts three parameters as input, the address of the collateral to be used (e.g. either token itself or XCHF), the lost address A and the nonce used in the previous step. If everything was correct, an event is emitted and the claim recorded.
3. After waiting for 6 months (default value), Alice can call `resolveClaim` (providing her lost address as an argument A) to gain back her shares and the collateral.

If the key is found again, or the claim was made maliciously, the rightful owner can call `clearClaim()` to delete the claim and seize the collateral posted.

Claims can be deleted by a special role (in this case the collateral is returned). There is a function `getClaimDeleter()` which we expect the subcontract to override that defines who can do this (typically the issuer). The purpose of this is to protect shareholders in cases where they cannot act on their own for some reason.

As a collateral, the share tokens themselves can be used. E.g. if you lost your key, get a friend to stake their shares for you. A custom collateral (ERC20 token) can be set by the issuer. Using e.g. XCHF has the advantage that during the waiting period the amount staked is not subject to the volatility of Ether.

The equity contract and Swiss law also allows the issuer to declare certain shares invalid ('kraftlos'). Legally, the requires a ruling in which a court officially confirms that the shares indeed have been lost. This should only be used if it is certain that the the tokens in question can never be accessed again as invalid tokens are not excluded from executing standard operations. Declaring a token invalid does not move, immobilize or destroy it, it just flags them by issuing an according message. The same happens with a physical share certificate: declaring it invalid does not require its destruction. 
