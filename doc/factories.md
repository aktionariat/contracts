# Factories

Documentation for the [AktionariatFactory](../contracts/factories/AktionariatFactory.sol), which deploys the contracts of a company: `Shares`, `SharesUnderAgreement` with its CCIP lockbox and lock-release pool, and optionally a `DirectInvestment` and a `SecondaryMarket`. On other chains it deploys the bridged wrapper with its burn-mint pool, only when the issuer enables that chain.

## Addresses

Every contract is created with CREATE3 ([Create3.sol](../contracts/factories/lib/Create3.sol)): a 16-byte proxy is created with CREATE2 and then runs CREATE, so the address depends only on the factory address and the salt, not on the bytecode or the constructor arguments. The base token's salt is `keccak(ticker)`; the others are `keccak(ticker, suffix)` with one `SALT_SUFFIX_*` constant per contract kind (`SHA`, `DIRECT_INVESTMENT`, `SECONDARY_MARKET`). The wrapper suffix is shared with the bridged token. The `DirectInvestment` and market salts also carry the version their store reports, so an upgraded contract lands on a new address while a second deployment of the same version is refused. `predictCompany(ticker)` returns all addresses for the current store versions; `predictDirectInvestment(ticker, version)` and `predictSecondaryMarket(ticker, version)` predict any version.

Chainlink's pools and the lockbox record `msg.sender` as their owner in the constructor. Under CREATE3 that would be the throwaway proxy, so they are created with CREATE2 ([Create2.sol](../contracts/factories/lib/Create2.sol)) directly by the factory, which then owns them. Their addresses depend on the init code and are therefore chain-specific; `predictCompany` and `predictBridgedPool(ticker)` compute them from the stores and Chainlink settings in place. The pool salt carries the pool store's version, the lockbox is permanent.

The factory itself is deployed through the public deterministic deployment proxy (`0x4e59b44847b379578588920ca78fbf26c0b4956c`) with a fixed salt and the deployer address as its only constructor argument, so it sits on the same address on every chain. A wrapper deployed on the home chain and its bridged twin deployed on another chain therefore share one address.

A ticker can be used once per chain. A failed or misconfigured deployment is redone under a new ticker on every chain, so the addresses stay aligned.

## Bytecode stores

The factory holds no bytecode. Each contract it deploys has a store ([BytecodeStore](../contracts/factories/lib/BytecodeStore.sol)) that returns the creation code and the `VERSION` of that contract: `SharesFactory`, `SharesUnderAgreementFactory`, `BridgedSharesUnderAgreementFactory`, `DirectInvestmentFactory`, `SecondaryMarketFactory`, and for Chainlink's pools `LockReleaseTokenPoolFactory` and `BurnMintTokenPoolFactory`, which return the creation code of the pinned `@chainlink/contracts-ccip` package (no source is copied). Splitting them keeps every contract under the 24 KB code-size limit. The owner sets the stores per chain, and `versions()` reports what a deployment would produce.

## Deploying a company

`deployCompany`, `deployCompanyWithDirectInvestment` and `deployCompanyWithDirectInvestmentAndSecondaryMarket` run on the home chain only. In one transaction the factory deploys the base token and the wrapper owned by itself, the lockbox and the lock-release pool for the wrapper, applies the allowlist regime, registers itself as the wrapper's CCIP administrator and maps the pool in Chainlink's token admin registry, deploys the optional contracts owned by the issuer, and transfers both tokens to the issuer's multisig given as `owner`. A zero owner is refused.

The pool and the lockbox are offered to the issuer with Chainlink's two-step ownership: the issuer's multisig calls `acceptOwnership()` on each, two plain proposals without parameters. Until then nobody can change the bridge configuration. No remote chain is configured at deployment; the pool owner adds one with `applyChainUpdates` when a chain is enabled. The factory stays the CCIP administrator and can remap the pool with `setRegisteredPool` if Chainlink's pool contracts are ever upgraded.

With `restricted` set, transfer restrictions are switched on for both tokens, the wrapper is typed Admin on the base and the market, DirectInvestment, pool and lockbox are typed Allowed on the wrapper (see [allowlist.md](allowlist.md), Intermediaries). Without it nothing is typed.

`addDirectInvestment(ticker, params)` and `addSecondaryMarket(ticker)` add to a company deployed without them, or deploy the next version once the store is updated; the new contract is owned by whoever owns the wrapper at that time. A company has one `DirectInvestment` and one market per version. The factory no longer owns the wrapper, so under a restricted regime the issuer types the new contract Allowed afterwards.

The `DirectInvestment` and the market are built with the factory's `currency`, `paymentHub` and `router` settings.

## Enabling another chain

`deployBridgedToken(ticker, symbol, name, terms, restricted, owner, home)` runs on every chain but the home chain and deploys a [BridgedSharesUnderAgreement](../contracts/shares/sha/BridgedSharesUnderAgreement.sol) on the home-chain wrapper's address, together with its burn-mint pool pointed at `home` (the home chain's selector and pool address). The token is minted and burned by its pool only; the owner cannot mint, and burns a lost address only through the time-locked recovery. Under a restricted regime the pool is typed Allowed on it, because holders send to the pool to bridge out. The pool is offered to the issuer as on the home chain.

Nothing is deployed on another chain unless the backend calls this function, which the issuer portal does when the issuer enables the chain. To open the bridge the issuer then adds the new chain to the home pool with `applyChainUpdates` (one proposal on the home chain) and accepts the new pool's ownership (one proposal on the new chain).

What the bridge does to holders is covered in [allowlist.md](allowlist.md): a frozen holder cannot bridge out, a bridged-in transfer to an unlisted or frozen receiver waits until the issuer types it, and the lockbox is the custody address of the whole bridged float.

## Gas

Measured on a mainnet fork: company 10.9M, of which about 5M are Chainlink's pool and lockbox; with DirectInvestment 11.9M, with DirectInvestment and market 14.2M, restricted adds about 0.1M; `addSecondaryMarket` 2.3M, `addDirectInvestment` 1.0M. Deploying Shares and the wrapper by hand costs 6.2M against 5.8M through the factory, because the bytecode is not sent as calldata.
