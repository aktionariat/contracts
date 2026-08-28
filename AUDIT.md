# Audit

Aktionariat contracts audit specifications.

## Files to be covered

The Audit has to cover all files, all functions, all branches and all lines within folders:

```
├── contracts
│   ├── ERC20
│   ├── investment
│   ├── market
│   ├── multichain
│   ├── multisig
│   ├── shares
│   │   ├── base
│   │   └── sha
│   └── utils
```

Given the structure of the code, `shares`, `multichain` and `ERC20` folders are highly coupled and could be seen as a single block.
Those folders hold token contracts, `Shares`, `SharesUnderAgreement` and `BridgedSharesUnderAgreement`.

`investment` holds two important contracts `DirectInvestment` and `PaymentHub`, which are the main entry for direct company investment.

`market` holds the SecondaryMarket and the TradeReactor contracts, which serve as the `SharesUnderAgreement` secondary market between two parties.

`multisig` holds the multichain multisig wallet contracts.

`utils` holds all utilities that contracts within the audit scope use.

## Not to be covered Files

Files that are not to be covered by the audit reside within folders:

```
├── contracts
│   ├── EIP7702
│   ├── mocks
│   ├── factories
│   │   ├── base
│   │   ├── lib
│   │   └── logics
```

## Trusted Actors

We assume that the Chainlink CCIP infrastructure is benevolent.
We assume that the router within secondary market is benevolent.

## Tests

You can find our test suite at the `test` folder, we have both hardhat tests and foundry specifc tests. We use foundry package to be able to run foundry specific tests within hardhat without importing the library.

You are free to change the repository, except the `contracts` folder, as you wish to use an environment that you are more comfortable with.

If you could leave additional, added tests to the repository after the audit it would be much appreciated.

## Terms

You have a hard deadline of Friday 04.09.26 at 17:00 PM Zürich time.

The Audit has to cover any possible vulnerability.
Additional suggestions would be great.
