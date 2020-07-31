# Drag-Along Mechanism

TODO: improve. Move too technical parts into source code as code comment and add nice screenshots of the app and the like.

## Overview and Motivation

Typical shareholder agreements contain 'drag-along' and 'tag-along' clauses. A drag-along clause allows a majority shareholder (defined by some quorum) to force the minority shareholders to participate in selling all company shares subject, while the tag-along clause guarantees the minority shareholders that they can always co-sell their shares if a majority shareholder sells theirs. Enforcing a drag-along clause can be time consuming as all involved parties need to be contacted, need to sign an agreement, and need to be paid. Facilitating this process is an ideal use case for an enhanced blockchain share.

## High-Level Objectives

The ERC20 contract [ERC20Draggable](../src/ERC20Draggable.sol) solves some of the main problems surrounding the drag-along process.

On a high-level, it offers the following functionality:

- Given an ERC20 share token, the drag-along contract 'wraps' the share token. This means that shares can be exchanged for draggable tokens. In this process, the drag-along contract holds the wrapped shares and instead issues an equal amount of new draggable tokens.
- If a single shareholder or a small group of them have a sufficient number of draggable tokens, they should be able to take over control of all the shares held by the draggable contract.
- While the majority shareholder gets the shares held in the draggable contract, the buyer must deposit an amount equal to the value of the remaining shareholder's draggable tokens in a currency such as for example Crypto Francs ([XCHF](https://www.swisscryptotokens.ch)).
- At this point the minority shareholders can swap their draggable tokens for the corresponding currency amount.

## Some Considerations

- As we cannot always expect a single shareholder to posess a majority, we allow for a voting. It is assumed that in practice, a vote will only be called if it is clear that a positive result can be forced with a small number of votes by the largest shareholders.
- We are aware that draggable tokens can be held by smart contracts and traded through smart contracts (e.g. [Uniswap](https://uniswap.io)) as well as decentralised and centralised exchanges. For this reason, swapping tokens for the corresponding currency amount after a successful drag-along procedure is a process that needs to be initiated by the user. This means that after the drag-along process the drag-along tokens can still be traded freely, however, at this point they do not legally represent a share anymore but a claim to the payout amount.
- The draggable contract can be deployed entirely independently from the equity contract without any special permissions.
- The focus of this project is to facilitate the drag-along/tag-along process for all involved parties. We explicitly <b>do not try to attempt to reflect or enforce all conditions </b> found in a typical shareholder agreement as the complexity grows very quickly and the benefits would be questionable at best. It is understood that all clauses of the agreement are valid and have to be followed even if they cannot be enforced on a smart contract level.

## The ERC20Draggable Contract

The [ERC20Draggable](../src/ERC20Draggable.sol) contract contains all the functionality related to the drag-along clause. In the following we describe the standard process of issuing equity bound to a shareholder agreement followed by a drag-along at some point.

1. Any shareholder who owns at least 5% of the company can call `initiateAcquisition` to make an acquisition offer. As an argument, the user includes the price offered per share. After a variety of conditions have been verified (see test docs), a new offer is created (represented by an instance of the [Acquisition](../src/Acquisition.sol) contract). To make the offer, the buyer has to place a non-refundable one-time fee of 5kCHF. This is to prevent users from making offers if they don't mean it. The rest of the money for the acquisition does not have to be transferred at hits point but it is checked that the user's balance and allowance to the drag-along contract are sufficient. The tokens held on the owner's address are excluded from the calculation.
2. Now the voting begins. Any token holder can vote 'yes' or 'no'.
3. If the absolute quorum is reached before the voting period ends, or the relative quorum is reached at the end, the buyer can call `completeAcquisition` to complete the process. As a result, all the shares held by the drag-along contract are transfered to the buyer and the buyer deposits the total sum to be payed out to the other shareholders in return.
4. The token holders can now swap their drag-along tokens for the defined currency amount.

## Notes

- If the offer has expired or the offer is not well funded anymore (e.g. buyer sold some shares or moved away their XCHF), anyone can kill the current offer by calling `contestAcquisition`.
- The person who made the offer can retract it at any point in time but loses the initial one time fee.
- Counteroffers can be made, but the price needs to be at least 5% better than the previous offer. Reclaiming the offer fee for the initial offerer is an offline process through aktionariat.com .
- A case can occur where shares need to be unwrapped from the drag-along contract. Think for example of a company buying back shares to destroy them. This is possible through the `burn` function, which burns the corresponding share token directly.
