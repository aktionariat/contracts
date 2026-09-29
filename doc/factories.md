# Factories

Documentation for the [AktionariatFactory](../contracts/factories/AktionariatFactory.sol), which deploys the contracts of a company: `Shares`, `SharesUnderAgreement`, and optionally a `DirectInvestment` and a `SecondaryMarket`. On other chains it deploys the bridged wrapper.

## Addresses

Every contract is created with CREATE3 ([Create3.sol](../contracts/factories/lib/Create3.sol)): a 16-byte proxy is created with CREATE2 and then runs CREATE, so the address depends only on the factory address and the salt, not on the bytecode or the constructor arguments. The base token's salt is `keccak(ticker)`; the others are `keccak(ticker, suffix)` with one `SALT_SUFFIX_*` constant per contract kind (`SHA`, `SECONDARY_MARKET`, and `DIRECT_INVESTMENT` with an index appended). The wrapper suffix is shared with the bridged token. `predictCompany(ticker)` returns all four addresses before anything is deployed.

The factory itself is deployed through the public deterministic deployment proxy (`0x4e59b44847b379578588920ca78fbf26c0b4956c`) with a fixed salt and the deployer address as its only constructor argument, so it sits on the same address on every chain. A wrapper deployed on the home chain and its bridged twin deployed on another chain therefore share one address.

A ticker can be used once per chain. A failed or misconfigured deployment is redone under a new ticker on every chain, so the addresses stay aligned.

## Bytecode stores

The factory holds no bytecode. Each contract it deploys has a store ([BytecodeStore](../contracts/factories/lib/BytecodeStore.sol)) that returns the creation code and the `VERSION` of that contract: `SharesFactory`, `SharesUnderAgreementFactory`, `BridgedSharesUnderAgreementFactory`, `DirectInvestmentFactory`, `SecondaryMarketFactory`. Splitting them keeps every contract under the 24 KB code-size limit. The owner sets the stores per chain, and `versions()` reports what a deployment would produce.

## Deploying a company

`deployCompany`, `deployCompanyWithDirectInvestment` and `deployCompanyWithDirectInvestmentAndSecondaryMarket` run on the home chain only. In one transaction the factory deploys the base token and the wrapper owned by itself, applies the allowlist regime, deploys the optional contracts owned by the issuer, and transfers both tokens to the issuer's multisig given as `owner`. A zero owner is refused.

With `restricted` set, transfer restrictions are switched on for both tokens, the wrapper is typed Admin on the base and the market and DirectInvestment are typed Allowed on the wrapper (see [allowlist.md](allowlist.md), Intermediaries). Without it nothing is typed.

`addDirectInvestment(ticker, params, index)` and `addSecondaryMarket(ticker)` add to an existing company; the new contract is owned by whoever owns the wrapper at that time. The factory no longer owns the wrapper, so under a restricted regime the issuer types the new contract Allowed afterwards.

The `DirectInvestment` and the market are built with the factory's `currency`, `paymentHub` and `router` settings.

`deployBridgedToken(ticker, symbol, name, terms, restricted, owner)` runs on every chain but the home chain and lands on the home-chain wrapper's address.

## Gas

Measured on a mainnet fork: company 5.8M, with DirectInvestment 6.8M, with DirectInvestment and market 9.0M, restricted adds about 0.1M; `addSecondaryMarket` 2.3M, `addDirectInvestment` 1.0M. Deploying Shares and the wrapper by hand costs 6.2M, more than through the factory, because the bytecode is not sent as calldata.
