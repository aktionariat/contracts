# Shareholder Registry

![shareholder registry](https://hub.aktionariat.com/images/contracts/registry.jpg)

[Aktionariat](http://aktionariat.com) constructs the shareholder registry from two sources of information:

1. The blockchain-based token registry implemented by our ERC‑20 contract “[Shares](../src/shares/Shares.sol)”.
2. A mapping between addresses and shareholders kept in a traditional database.

Shareholders can register themselves by either using the Aktionariat app or a widget the issuer can place on its website. Aktionariat then keeps track of all token transfers for its clients and automatically updates the shareholder registry accordingly. The shareholder registry can be accessed by the board members on the corporate dashboard provided by Aktionariat, from where it also can be exported as a spreadsheet if desired.

## Transfers

Legally, a transfer of a share token to a new address transfers only the ownership over the token, but does not transfer the shareholder rights. The shareholder rights rest with the old shareholder until the new shareholder completed the registration with the company. For those familiar with the transfer of Swiss shares, one can say that the token transfer replaces the assignment declaration (Abtretungserklärung) of a traditional transaction. But just like with traditional transactions, the new shareholder must notify the company about the transaction and demand to be entered into the shareholder registry before enjoying any shareholder rights. Shareholder rights include the right to vote at the general assembly and the right to receive a dividend. But in relation to others, most notably the tax authority, a buyer is already considered the owner of the shares as soon as they received the tokens, regardless of whether they have already registered themselves or not. Separating the technical token transfer from the registration has the great benefit of allowing swift short-term trading without formal registration, while at the same time ensuring that long-term shareholders have a strong incentive to register themselves.

Consequently, not every token transfer leads to a change in the shareholder registry. Also, registrations do not retroactively change the shareholder registry. For example, let us assume Alice initially holds 10 shares on a registered address and transfers 7 of them to Ben, who forwards 5 shares to an address registered by Charles. Assuming Ben did not register his address yet, the shareholder registry will show a transfer of 5 shares from Alice to Charles, but no intermediate transactions. If Ben later registers his address, a new transfer of 2 shares from Alice to Ben is added to the shareholder registry. The date of that transfer is not the day Alice transferred the 7 shares, but the date of Ben’s registration. We do not retroactively generate an entry to reflect the intermediate transfer of five shares to Ben, as he forwarded the shares before registering. In the future, we might also add an option to unregister an address again, allowing for the rare use case of an address belonging to different persons over time, which can for example happen with paper wallets.

## Sub-Registers

Sometimes, tokens are held by smart contracts that are ERC‑20 contracts themselves. For example, our [draggable contract](draggable.md) is an ERC-contract that wraps an existing ERC‑20 contract in order to enforce the drag-along clause of typical shareholder agreements. The wrapped shares become draggable shares and are technically represented by a different token, even though they legally still confer ownership in the underlying shares. In this case, we automatically treat the holder of the wrapping token as the shareholder, even though the token is held indirectly through a sub-register.
