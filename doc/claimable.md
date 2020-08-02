# Claim Mechanism

## Motivation
It is desirable that share tokens (which legally represent the company's equity) do not get 'lost' if a shareholder loses the private key to their account or accidentally sends them to an invalid address. While some issuers address this by adding a back-door to their smart contract, giving them full control over all tokens, we prefer following a decentralized approach. This is also what thethe Swiss Blockchain Federation recommends in their [Security Token Circular](http://blockchainfederation.ch/wp-content/uploads/2019/12/SBF-Circular-2019-01-Tokenized-Equity-4.pdf). Our decentralized approach allows holders to reclaim their shares without having to rely on a centralized authority.

## Claim Process

The claim process works as follows: Let us assume that Alice has lost the key to her address A. She picks a new address B and makes all calls from the new address.

1. Alice makes sure she has enough collateral ready to make the claim and grants an according allowance to the contract of the token she wants to reclaim.
1. Alice calls the function `declareLost(address, collateral)` to declare that the tokens on the specified address are hers and that she wants to retrieve them through the claim mechanism. The second parameter is the collateral to be used, which is transferred to the token contract.
2. After waiting for 6 months (this value can be configured by the issuer, but must be at least 3 months), Alice can call `resolveClaim` (providing her lost address as an argument) to gain back her shares and the collateral.

If the key is found again, or the claim was made maliciously, the rightful owner can always call `clearClaim()` from the claimed address to delete the claim and seize the collateral.

Claims can also be deleted by a special role (in this case the collateral is returned). There is a function `getClaimDeleter()` that defines who can do this (typically the issuer). The purpose of this is to protect shareholders in cases where they cannot act on their own for some reason. Also, this guards against malicious use of the claim mechanisms in cases where the attacker got to know that the claimed address got lost and acts before the rightful owner does.

## Front-Running

Earlier versions of this contract contained a mechanism to guard against front-running. But in the only case where we had to claim back lost tokens, the tokens were accidentally sent to an obviously invalid address, so the front-running protection would not have helped. Also, an attacker systematically performing front-running attacks could be easily outwitted by initiating a claim to an address under your control, letting the attacker front-run the claim, and then take the attackers collateral.

## Collateral

As a collateral, the share tokens themselves can be used. E.g. if you lost your key, get a friend to stake their shares for you. A custom collateral (ERC20 token) can be set by the issuer. Using a stablecoin like XCHF has the advantage that during the waiting period the amount staked is not subject to the volatility of Ether. Ether is not suppored as collateral, but the issuer could decide to accept wrapped ether.