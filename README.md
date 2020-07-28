The public repository for all smart contracts used by Aktionariat.

# Drag-Along Contract - High-Level Description

## 1. Overview and Motivation

Shareholder agreements are commonplace in Swiss limited companies, especially if an exit scenario is expected. Typical shareholder agreements contain 'drag-along' and 'tag-along' clauses. A drag-along clause allows a majority shareholder (defined by some quorum) to force the minority shareholders to participate in selling all company shares subject to the shareholder agreement, while the tag-along clause in turn guarantees the minority shareholders that they can always sell their shares as well if a majority shareholder sells theirs. Enforcing a drag-along clause in practice in a traditional setting can be very time consuming as all involved parties need to be contacted, need to sign an agreement and need to be paid. Facilitating this process is an ideal use case for an enhanced blockchain share.

## 2. High-Level Objectives

The ERC20 contract `ERC20Draggable` solves some of the main problems surrounding the drag-along process.

On a high-level, it offers the following functionality:

- Given an ERC20 share token, the drag-along contract 'wraps' the share token. This means that shares can be exchanged for draggable tokens. In this process, the drag-along contract holds the wrapped shares and instead issues an equal amount of new draggable tokens.
- If a single shareholder or a small group of them have a sufficient number of draggable tokens, they should be able to take over control of all the shares held by the draggable contract.
- While the majority shareholder gets the shares held in the draggable contract, the buyer must deposit an amount equal to the value of the remaining shareholder's draggable tokens in a currency such as for example Crypto Francs ([XCHF](https://www.swisscryptotokens.ch)).
- At this point the minority shareholders can swap their draggable tokens for the corresponding currency amount.

#### Important Considerations:

- As we cannot always expect a single shareholder to posess a majority, we allow for a voting. It is assumed that in practice, a vote will only be called if it is clear that a positive result can be forced with a small number of votes by the largest shareholders.
- We are aware that draggable tokens can be held by smart contracts and traded through smart contracts (e.g. [Uniswap](https://uniswap.io)) as well as decentralised and centralised exchanges. For this reason, swapping tokens for the corresponding currency amount after a successful drag-along procedure is a process that needs to be initiated by the user. This means that after the drag-along process the drag-along tokens can still be traded freely, however, at this point they do not legally represent a share anymore but a claim to the payout amount.
- The draggable contract can be deployed entirely independently from the equity contract without any special permissions.
- The focus of this project is to facilitate the drag-along/tag-along process for all involved parties. We explicitly <b>do not try to attempt to reflect or enforce all conditions </b> found in a typical shareholder agreement as the complexity grows very quickly and the benefits would be questionable at best. It is understood that all clauses of the agreement are valid and have to be followed even if they cannot be enforced on a smart contract level.

## 3. The ERC20Claimable Contract

It is important that share tokens (which legally represent the company's equity) don't get 'lost' if a shareholder loses the private key to their account. The standard claim process works as follows: Let us assume that Alice has lost the key to her address A. She picks a new address B and makes all calls from the new address.

1. Alice calls the function `prepareClaim`. As an argument she provides the hash of the concatenation of a user chosen nonce, her new address B and her lost address A.
2. After waiting for 24 hours, she has a 24 hour window to call `declareLost`. This function accepts three parameters as input, the address of the collateral to be used (e.g. either token itself or XCHF), the lost address A and the nonce used in the previous step. If everything was correct, an event is emitted and the claim recorded.
3. After waiting for 6 months (default value), Alice can call `resolveClaim` (providing her lost address as an argument A) to gain back her shares and the collateral.

- If the key is found again, or the claim was made maliciously, the rightful owner can call `clearClaim()` to delete the claim and seize the collateral posted.
- Claims can be deleted by a special role (in this case the collateral is returned). There is a function `getClaimDeleter()` which we expect the subcontract to override that defines who can do this (typically the owner of the equity contract). The purpose of this is to protect shareholders in cases where they cannot act on their own for some reason.

For this contract, the following adjustments have been made:

- The share or draggable token itself can now be used as a collateral. E.g. if you lost your key, get a friend to stake their shares for you.
- A custom collateral (ERC20 token) can be set. Using e.g. XCHF has the advantage that during the waiting period the amount staked is not subject to the volatility of Ether.
- As the draggable token does not have an owner, it obtains the claim parameters such as the currency used and the collateral rate from the share contract.
- The equity contract now also allows the owner to declare certain share tokens invalid ('kraftlos'). This is to be used for example after a court ruling or if for some reason certain tokens cannot be recovered through the standard claim process (e.g. tokens sent erroneously to the draggable contract). This should only be used if it is certain that the the tokens in question can never be accessed again as invalid tokens are not excluded from executing standard operations.

## 4. The ERC20Draggable Contract

The `ERC20Draggable` contract contains all the functionality related to the drag-along clause. In the following we describe the standard process of issuing equity bound to a shareholder agreement followed by a drag-along at some point.

### Issuance:

1. The ERC20 equity contract `Shares` is deployed with the desired parameters. This contract supports claims as it inherits from `ERC20Claimable`. A currency token such as XCHF can be set as a custom collateral. The company is the owner of this contract.
2. Share tokens are minted but not distributed to the shareholders.
3. The ERC20 draggable contract `DraggableShares` is deployed. This contract does not have an owner and could in principle be deployed by anyone.
4. Using the function `wrap` the share tokens are swapped for draggable shares. Now the draggable contract itself holds the actual shares.
5. The newly created drag-along tokens are distributed to the shareholders.
6. The share registry listens to the transfer events from both ERC20 contracts and by matching events with a mapping table of addresses and users generates the shareholder transactions for the registry.

### Drag-Along:

1. Any shareholder who owns at least 5% of the company can call `initiateAcquisition` to make an acquisition offer. As an argument, the user includes the price offered per share. After a variety of conditions have been verified (see test docs), a new offer is created (represented by an instance of the `Acquisition` contract). To make the offer, the buyer has to place a non-refundable one-time fee of 5kCHF. This is to prevent users from making offers if they don't mean it. The rest of the money for the acquisition does not have to be transferred at hits point but it is checked that the user's balance and allowance to the drag-along contract are sufficient. The tokens held on the owner's address are excluded from the calculation.
2. Now the voting begins. Any token holder can vote 'yes' or 'no'.
3. If the absolute quorum is reached before the voting period ends, or the relative quorum is reached at the end, the buyer can call `completeAcquisition` to complete the process. As a result, all the shares held by the drag-along contract are transfered to the buyer and the buyer deposits the total sum to be payed out to the other shareholders in return.
4. The token holders can now swap their drag-along tokens for the defined currency amount.

### Notes:

- If the offer has expired or the offer is not well funded anymore (e.g. buyer sold some shares or moved away their XCHF), anyone can kill the current offer by calling `contestAcquisition`.
- The person who made the offer can retract it at any point in time but loses the initial one time fee.
- Counteroffers can be made, but the price needs to be at least 5% better than the previous offer. Reclaiming the offer fee for the initial offerer is an offline process through aktionariat.com .
- A case can occur where shares need to be unwrapped from the drag-along contract. Think for example of a company buying back shares to destroy them. This is possible through the `burn` function, which burns the corresponding share token directly.

## 5. Contract Structure

We have the following dependencies:

- `DraggableShares` is `ERC20Claimable` and `ERC20Draggable`
- `Shares` is `ERC20Claimable` and `Pausable`
