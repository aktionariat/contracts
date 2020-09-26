# Drag-Along Mechanism

![drag along](draggable.jpg)

## Overview and Motivation

Typical shareholder agreements contain 'drag-along' and 'tag-along' clauses. If someone makes an acquisition offer and a majority of shareholders wants to sell, the drag-along clause allows them to force the rest of the shareholders to join them in selling their shares at the same price. This is useful because an acquirer often wants to either buy a company completely or not at all. This is similar to a squeeze-out on the stock market, which allows someone owning 98% of a company to buy the remaining 2%. In contrast, a drag-along clause is often already enforcable when 75% or so of the shareholders agree. However, enforcing a drag-along clause can be time consuming in practice as all involved parties need to be contacted, need to sign a transfer agreement, and need to be paid. Our draggable smart contract fully automates this process for tokenized shares, thereby allowing companies to have thousands of shareholders without losing the strategic option of an exit.

## Functionality

The ERC20 contract [ERC20Draggable](../src/ERC20Draggable.sol) can be used to convert any existing ERC20 token (referred to as base token) into a draggable token by wrapping it. Once deployed, the contract offers the following functionality:

- Anyone owning base tokens can wrap them at any time, thereby converting these base tokens into draggable tokens. The base tokens still exist, but are now under control of the draggable contract. Think of this process as taking a traditional paper certificate and putting it into a sealed envelope. For each outstanding draggable token, the draggable contract holds exactly one base token as backing. A draggable token legally represents a base token that is bound to a shareholder agreement.
- A majority of 75% of token holds can update the shareholder agreement and migrate all the base tokens to a new contract that represents a different shareholder agreement or even end the shareholder agreement completely. Once the agreement has ended, token holders are free to unwrap their base tokens again - or to break the seal and open the envelope when thinking in terms of the paper analogy.
- Anyone can make an acquisition offer at any time. When doing so, the full acquisition amount must be deposited in a currency of choice (for example 10 million DAI, if the company is valued that highly). If 75% of all votes cast within a given timeframe (e.g. 3 months) approve the acquisition, all base tokens are sent to the acquirer and replaced with the according amount of money. From now on, the draggable tokens do not represent a share any more, but the according amount of the acquisition currency (e.g. 100 DAI per token). Token holders are free to unwrap their DAI at any time. In the paper analogy, the shareholders can now open their sealed envelopes as the shareholder agreement has ended, but instead of finding a certificate inside, they magically find a bundle of bank notes.

## Some Details

- If the offer has expired or the offer is not well funded anymore, anyone can kill the current offer by calling `contestAcquisition`.
- When making an offer, a license fee of 3 Ether is charged. This has the nice side-effect of ensuring that the offer is serious.
- The person who made the offer can cancel the offer at any point in time.
- Counteroffers can be made, but the price needs to be at least 5% better than the previous offer and in the same currency.
- The offer can end early if there enough votes have been cast to make sure that the remaining votes cannot make a difference any more.

## Why no tag-along?

While it is relatively easy to implement a drag-along clause in a smart contract, there is no straight-forward way to implement a tag-along clause. This illustrates that smart contracts are actually not that smart. A tag-along clause allows a shareholder to sell shares at the same price if a other shareholder sell a large package of shares to a buyer. This is difficult to automatically enforce because a transfer of shares (which could easily be detected) does not necessarily imply a sale of shares and even if it does represent a sale, it is unclear what the price was. For example, if someone 1000 shares from address 0x123.. to address 0x345.., it is not clear whether the 1000 shares changed their owner. Maybe the holder just moved them to a different wallet? And even if the shares where sold, there is no guarantee that shares were paid for in a blockchain-based transaction that a smart contract could refer to. The enforcing of a tag-along term necessarily requires human intervention and cannot be automated. The same holds for a large number of other contractual clauses. We are fortunate that the most important one, the drag-along, can be represented with a relatively simple smart contract.

## License Fee

For this smart contract, we created a new type of software license, the "MIT License with Automated License Fee Payments". Anyone is free to reuse the code as long as the built-in license fee of 3 Ether, paid to Aktionariat AG, is preserved.
