# Drag-Along Mechanism 1.0

![drag-along](https://hub.aktionariat.com/images/contracts/draggable.jpg)

## Version History

Versions prior to 1.0 are documented within the relevant Token Holder Agreements.

Internal note: this document is referred to from various places, including legal documents. In case of material changes, we need to bump the version number and provide a link to old version. Furthermore, the DNS entry of [dragdoc.aktionariat.com](dragdoc.aktionariat.com/) should always redirect to this document and needs to be updated in case this document is moved.

## Overview and Motivation

Typical shareholder agreements contain “drag-along” and “tag-along” clauses. If someone makes an acquisition offer and a majority of shareholders wants to sell, the drag-along clause allows them to force the rest of the shareholders to join them in selling their shares at the same price. This is useful because an acquirer often wants to either buy a company completely or not at all. This is similar to a squeeze-out on the stock market, which allows someone owning 98% of a company to buy the remaining 2%. In contrast, a drag-along clause is often already enforceable when 75% or so of the shareholders agree. However, enforcing a drag-along clause can be time consuming in practice as all involved parties need to be contacted, need to sign a transfer agreement, and need to be paid. Our draggable smart contract fully automates this process for tokenized shares, thereby allowing companies to have thousands of shareholders without losing the strategic option of an exit.

## Drag-Along Process
This section describes the automatic enforcement of the Drag-Along clause implemented by the [SHA smart contract](../src/draggable/ERC20Draggable.sol).

### Initiation
The Offering Party can initiate an offer to acquire all (but not less than all) SHA Tokens (the "Offering Party") from the other SHA Token Holders (the "Selling Parties") for a specific price per Share (the "Offering Price", together with the further terms, the "Acquisition Offer") through interaction with the SHA Contract, subject to a non-reimbursable software licence fee payable as defined in section *License Fee*. By doing so, a smart contract governing the acquisition ("Offer Contract") is created and an "OfferCreated" event is emitted on the Blockchain. It is the responsibility of each Token Holder to monitor the Blockchain for such events or to use a service to do so on her or his behalf.

### Voting
After the initiation of an offer, the Voting Period starts. During the Voting Period any SHA Token Holder (including the Offering Party) may call the functions 'voteYes' and 'voteNo' to vote on the Drag-Along Offer. This only affects the tokens residing on the calling address and the vote count is automatically adjusted as additional tokens arrive at this address or as tokens leave the address again during the Voting Period. Note that the total supply of SHA Tokens may increase during the Voting Period as additional shareholders wrap newly tokenized shares or existing Base Tokens. Holders of other forms of shares can report their vote to the Oracle, which shall in turn report these votes to the Offer Contract within three business days. The Oracle can invoice the transaction fees for reporting the votes to the respective voters. After the end of the Voting Period, the Execution Period starts. After this point in time, no new votes are accepted any more, but the Oracle can still report votes it received before the end of the Voting Period to the Offer Contract. 

### Execution
Anyone can trigger the 'execution' function on the Offer Contract to enforce the acquisition at any time during the Voting Period or the Execution Period, given that all necessary conditions are met, namely that the Acquisition Quorum is reached and the required funding is available. Executing the Acquisition Offer assigns all wrapped Base Tokens to the Offering Party and replaces them with the sales proceeds. At the same time, this Agreement ceases to be contractually binding, allowing the SHA Token Holders to unwrap the sales proceeds in proportion to their tokens.

The Acquisition Quorum is reached if at least 75% of all shares approved the acquisition. Once the Voting Period ends, the shares for which no vote was cast are assumed to have voted yes and no in the same proportion as those shares that did vote. The votes of the shares not represented by SHA Tokens are reported through the Oracle.

### Cancellation
The Offering Party can cancel the offer at any time, calling the respective function on the Offer Contract. Furthermore, anyone can contest the Acquisition Offer, calling the respective function on the Offer Contract. This results in the Acquisition Offer being cancelled if the Offering Party did not make enough funds available, if the Execution Period has passed, or if the Acquisition Quorum has become unreachable under the assumption that the number of "no" votes will not decrease.
Further, anyone can make a higher counteroffer using the same acquisition currency as the current offer. Making such an offer cancels the old offer.

## Further Notes

- Anyone owning base tokens can wrap them at any time, thereby converting these base tokens into draggable tokens. The base tokens still exist, but are now under control of the draggable contract. Think of this process as taking a traditional paper certificate and putting it into a sealed envelope. For each outstanding draggable token, the draggable contract holds exactly one base token as backing. A draggable token legally represents a base token that is bound to a shareholder agreement.
- A majority of shareholders holding 75% of the shares can update the shareholder agreement and migrate all the base tokens to a new contract that represents a different shareholder agreement or even end the shareholder agreement completely. Once the agreement has ended, token holders are free to unwrap their base tokens again – or to break the seal and open the envelope when thinking in terms of the paper analogy.
- Anyone can make an acquisition offer at any time. When doing so, the full acquisition amount must be available in a currency of choice (for example 10 million DAI, if the company is valued that highly). If a given quorum (e.g. 75%) of all votes cast within a given timeframe (e.g. 60 days) approve the acquisition, all base tokens are sent to the acquirer and replaced with the according amount of money. From now on, the draggable tokens do not represent a share any more, but the according amount of the acquisition currency (e.g. 100 DAI per token). Token holders are free to unwrap their DAI at any time. In the paper analogy, the shareholders can now open their sealed envelopes as the shareholder agreement has ended, but instead of finding a certificate inside, they magically find a bundle of bank notes.
- In case not all shares are tokenized, an external oracle can report the votes of the other shareholders to the token contract
- If the offer has expired or the offer is not well funded anymore, anyone can kill the current offer by calling `contest` on the offer contract.
- The person who made the offer can cancel the offer at any point in time.
- Counteroffers can be made, but the price needs to be higher than the previous offer and in the same currency.
- The offer can be ended early if it is clear that the remaining votes cannot make a difference any more.

## Attack Vectors

A majority of shareholders could abuse the smart contract to acquire the shares of the remaining shareholders at a very small price by making a cheap acquisition offer and approving it. Doing so would likely constitute a violation of the shareholder agreement and the minority shareholder would have to hold the majority accountable using the traditional legal system. The assumption is that it is possible to identify some of the majority shareholder in such a case so they can be taken to court or everything settled bilaterally.

## Why no tag-along?

While it is relatively easy to implement a drag-along clause in a smart contract, there is no straight-forward way to implement a tag-along clause. This illustrates that smart contracts are actually not that smart. A tag-along clause allows a shareholder to sell shares at the same price if other shareholders sell a large package of shares to a buyer. This is difficult to automatically enforce because a transfer of shares (which could easily be detected) does not necessarily imply a sale of shares and even if it does represent a sale, it is unclear what the price was. For example, if someone moves 1′000 shares from address 0x123.. to address 0x345.., it is not clear whether the 1′000 shares changed their owner. Maybe the holder just moved them to a more secure wallet or a different custodian? Furthermore, it would also be possible to sell the shares without moving them to a new address, for example when they are held by an intermediary and assigned to the new owner contractually. But even if we could reliably detect transfers of ownership, there is no guarantee that the according payment is visible on the blockchain and that there were no side-agreements between buyer and seller. Therefore, the enforcing of a tag-along term necessarily requires human intervention and cannot be automated. The same holds for a large number of other contractual clauses. We are fortunate that the most important one, the drag-along, can be represented with a relatively simple smart contract.

## License Fee

For this smart contract, we created a new type of software license, the “[MIT License with Automated License Fee Payments](https://github.com/aktionariat/contracts/blob/master/LICENSE)”. Anyone is free to reuse the code as long as the built-in license fee, paid to [Aktionariat AG](https://aktionariat.com/), is preserved. The license fee of three Ether is due whenever a new acquisition offer is made and is to be payed by the prospective buyer. This has the nice side-effect of ensuring that the offer is serious.
