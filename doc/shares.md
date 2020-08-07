# Shareholder Registry

Aktionariat keeps track of all token transfers for its clients and automatically updates the shareholder registry accordingly.

Technically, the shareholder registry consists of two parts:

1. The blockchain-based token registry implemented by our ERC-20 contract ['Shares'](../Shares.sol).
2. A mapping between addresses and shareholders kept in a traditional database.

TODO: document FIFO rule, numbered shares, subregisters, legal requirements.