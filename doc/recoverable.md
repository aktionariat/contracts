# Recovery Mechanism

![token recovery](https://hub.aktionariat.com/images/contracts/saver.jpg)

Documentation for the token recovery mechanism implemented in [ERC20Recoverable.sol](../src/recovery/ERC20Recoverable.sol).

## Motivation

It is desirable that share tokens (which legally represent the company’s equity) do not get “lost” if a shareholder loses the private key to their account or accidentally sends them to an invalid address. While some issuers address this by adding a back-door to their smart contract, giving them full control over all tokens, we prefer following a decentralized approach. This is also what the Swiss Blockchain Federation recommends in their [Security Token Circular](https://blockchainfederation.ch/wp-content/uploads/2021/10/SBF-2021-01-Ledger_Based_Securities_2021-10-12.pdf). Our decentralized approach allows holders to reclaim their shares without having to rely on a centralized authority.

## Process

The recovery process works as follows: Let us assume that Alice has lost the key to her address A. She picks a new address B and makes all calls from the new address.

1. Alice makes sure she has enough collateral ready to make the claim and grants an according allowance to the [RecoveryHub.sol](../src/recovery/RecoveryHub.sol).
2. Alice calls the function `declareLost(token, collateralType, lostAddress)` to declare that the tokens on the specified address are hers and that she wants to retrieve them through the claim mechanism. The second parameter is the collateral to be used, which is transferred to the recovery hub.
3. After waiting for 6 months, Alice can call `recover` (providing her lost address as an argument) to gain back her shares and the collateral.

If the key is found again, or the claim was made maliciously, the rightful owner can always call `clearClaim` from the claimed address to delete the claim and seize the collateral. This makes attacks economically infeasible. When an attacker makes a claim for your address to obtain all your 7 shares in Example Inc., the attacker must also provide a collateral worth 7 shares. Now you have six months time to call `clearClaim`, thereby not only deleting the fraudulent claim, but also taking away the attacker’s collateral. If your wallet does not support calling custom methods such as `clearClaim`, you can also just transfer one share to a new address, which triggers an implicit call to `clearClaim` and has the same effect.

Claims can also be deleted by a special role (in this case the collateral is returned). There is a function `getClaimDeleter()` that defines who can do this (typically the issuer). The purpose of this is to protect shareholders in cases where they cannot act on their own for some reason. Also, this guards against malicious use of the claim mechanisms in cases where the attacker got to know that the claimed address got lost and acts before the rightful owner does.

## Collateral

As a collateral, the share tokens themselves can be used. E.g. if you lost your key, get a friend to stake their shares for you. A custom collateral (ERC‑20 token) can be set by the issuer. Using a stablecoin like XCHF has the advantage that during the waiting period the amount staked is not subject to the volatility of Ether. Ether is not supported as collateral, but the issuer could decide to accept wrapped ether.

## Example

In transaction [0x2802...61](https://etherscan.io/tx/0x2802faedf41532a1aba89d4f11577c2b2f886b6243616f3bc60da9eabeeecb61), someone we are familiar with accidentally sent 1′145 shares of ServiceHunter AG (SHS) to address 0x0479. That address is the hexadecimal representation of the number 1145 and an address that no one controls. To recover the shares, the owner invoked `declareLost` in transaction [0x2459...31](https://etherscan.io/tx/0x2459fb285211cf5cc2fdab716603e80725bc42ea9b144ecc7f8a35f7a4023731/advanced) with an additional 1145 shares as collateral. (Note that the SHS contract is based on the old version of our claimable mechanism which required an additional nonce parameter and a preclaim not described here.) After waiting for half a year, transaction [0x7429...38](https://etherscan.io/tx/0x7429eb777c208470c04dba3fec60d3fcac6c8cbb4f023e51d44f449444ff7538/advanced) was issued to resolve the claim, returning both the lost shares as well as the collateral to their owner. Note that in this example, the recovery function was implemented by token contract itself. In the meantime, this functionality has been moved to the recovery hub.
