import { keccak256, toUtf8Bytes } from "ethers";

// This is terrible, but it works
// The fact is, hardhat should make it possible to compile all contracts of an entire library
// or give a standard way to distribute ABIs so that hardhat can decode errors coming from txns
// when forking and running locally simulated chain
// Then projects should also distribute the code that matches the one that there is onchain

const targetSelectors = [
  "0x45ed80e9",
  "0x8d666f60",
  "0xe1cd5509",
  "0x24eb47e5",
  "0x4e487b71",
  "0xae9b4ce9",
  "0xc454d182",
  "0x2b5c74de",
  "0x15dbd825",
  "0x96c6fd1e",
  "0xdad89dca",
  "0x1a76572a",
  "0xf08bcb3e",
  "0xb5f20c2a",
  "0x96a19be9",
];

// Add your custom errors here
const errors = [
  "TestError()",

  "PaymentHub_InvalidAmount()",
  "PaymentHub_InvalidPath(IDirectInvestment,IERC20,bytes)",
  "ArrayLengthMismatch()",
  "DirectInvestment_BuyingDisabled()",
  "DirectInvestment_InvalidSettings()",
  "DirectInvestment_NotPaymentHub(address)",
  "DirectInvestment_InsufficientPayment(uint256,uint256)",

  "TokenNotSupported(address)",
  "ChainNotSupported(uint64)",
  "OnlyCallableByUpdaterOrOwner()",
  "StaleGasPrice(uint64,uint256,uint256)",
  "StaleTokenPrice(address,uint256,uint256)",
  "InvalidStalenessThreshold()",

  "UnsupportedDestinationChain(uint64)",
  "InsufficientFeeTokenAmount()",
  "InvalidMsgValue()",
  "OnlyOffRamp()",

  "TransfersPaused()",
  "Allowlist_ReceiverIsForbidden(address)",
  "Allowlist_SenderIsForbidden(address)",
  "Allowlist_ReceiverNotAllowlisted(address)",
  "NoSuccessorDefined()",
  "InvalidInitialization()",
  "NotInitializing()",
  "ERC20BalanceOverflow(address,uint256,uint256)",
  "FeeMissing(uint256,uint256)",
  "NoOfferFound()",
  "OfferPending()",
  "CannotCancel()",
  "DragAlongTooEarly(uint256,uint256)",
  "NotQualified()",
  "MigrationNotFound()",
  "MigrationTooEarly(uint256,uint256)",
  "ContractBinding()",
  "ContractNotBinding()",

  // Ownable2Owner chainlink
  "OwnerCannotBeZero()",
  "MustBeProposedOwner()",
  "CannotTransferToSelf()",
  "OnlyCallableByOwner()",

  "Ownable_NotOwner(address)",

  "NotPool(address)",

  // openzeppelin Errors
  "InsufficientBalance(uint256,uint256)",
  "FailedCall()",
  "FailedDeployment()",
  "MissingPrecompile(address)",

  // openzeppelin Create2
  "Create2EmptyBytecode()",

  //
  "UnableToPerformSetupCCIP_CanOnlySelfRegister(address,address)",
  "MissingDeploymentData()",
  "DeploymentFailed()",
  "InvalidAddress()",

  //
  "Panic(uint256)",

  //
  "DirectInvestment_BuyingDisabled()",
  "DirectInvestment_InvalidSettings()",
  "DirectInvestment_NotPaymentHub(address sender)",
  "DirectInvestment_InsufficientPayment(uint256 required, uint256 provided)",

  // Allowlist
  "TransfersPaused()",
  "Allowlist_ReceiverIsForbidden(address receiver)",
  "Allowlist_SenderIsForbidden(address sender)",
  "Allowlist_ReceiverNotAllowlisted(address receiver)",

  // Authorized executor
  "InvalidNonce()",
  "FunctionSignatureMismatch()",
  "CallReverted()",

  // AuthorizeCallVerifier
  "InvalidSignatureLength()",
  "InvalidSignature()",
  "InvalidSigner()",

  //
  "ERC20BalanceOverflow(address,uint256,uint256)",
  "TransfersPaused()",
  "IERC677_OnTokenTransferFailed()",

  // ERC20Errors
  "ERC20InsufficientBalance(address,uint256,uint256)",
  "ERC20InvalidSender(address)",
  "ERC20InvalidReceiver(address)",
  "ERC20InsufficientAllowance(address,uint256,uint256)",
  "ERC20InvalidApprover(address)",
  "ERC20InvalidSpender(address)",

  // TokenPool
  "CallerIsNotARampOnRouter(address)",
  "ZeroAddressNotAllowed()",
  "SenderNotAllowed(address)",
  "AllowListNotEnabled()",
  "NonExistentChain(uint64)",
  "ChainNotAllowed(uint64)",
  "CursedByRMN()",
  "ChainAlreadyExists(uint64)",
  "InvalidSourcePoolAddress(bytes)",
  "InvalidToken(address)",
  "Unauthorized(address)",
  "PoolAlreadyAdded(uint64,bytes)",
  "InvalidRemotePoolForChain(uint64,bytes)",
  "InvalidRemoteChainDecimals(bytes)",
  "MismatchedArrayLengths()",
  "OverflowDetected(uint8,uint8,uint256)",
  "InvalidDecimalArgs(uint8,uint8)",

  // LockReleaseTokenPool
  "InsufficientLiquidity()",
  "LiquidityNotAccepted()",

  // Evm2EVmOffRamp
  "ZeroAddressNotAllowed()",
  "CommitStoreAlreadyInUse()",
  "ExecutionError(bytes)",
  "InvalidSourceChain(uint64)",
  "MessageTooLarge(uint256,uint256)",
  "TokenDataMismatch(uint64)",
  "UnexpectedTokenData()",
  "UnsupportedNumberOfTokens(uint64)",
  "ManualExecutionNotYetEnabled()",
  "ManualExecutionGasLimitMismatch()",
  "DestinationGasAmountCountMismatch(bytes32,uint64)",
  "InvalidManualExecutionGasLimit(bytes32,uint256,uint256)",
  "InvalidTokenGasOverride(bytes32,uint256,uint256,uint256)",
  "RootNotCommitted()",
  "CanOnlySelfCall()",
  "ReceiverError(bytes)",
  "TokenHandlingError(bytes)",
  "ReleaseOrMintBalanceMismatch(uint256,uint256,uint256)",
  "EmptyReport()",
  "CursedByRMN()",
  "InvalidMessageId()",
  "NotACompatiblePool(address)",
  "InvalidDataLength(uint256,uint256)",
  "InvalidNewState(uint64,Internal.MessageExecutionState)",

  // MerkelMultiProof
  "InvalidProof()",
  "LeavesCannotBeEmpty()",

  // EnumerableMap
  "EnumerableMapNonexistentKey(bytes32)",

  // RateLimiter
  "BucketOverfilled()",
  "OnlyCallableByAdminOrOwner()",
  "TokenMaxCapacityExceeded(uint256,uint256,address)",
  "TokenRateLimitReached(uint256,uint256,address)",
  "AggregateValueMaxCapacityExceeded(capacity,uint256)",
  "AggregateValueRateLimitReached(minWaitInSeconds,available)",
  "InvalidRateLimitRate(Config)",
  "DisabledNonZeroRateLimit(Config)",
  "RateLimitMustBeDisabled()",

  // library
  "PriceNotFoundForToken(address)",

  // AggregateRateLimiter
  "InvalidEVMAddress(bytes)",

  // EVM2EVM
  "InvalidExtraArgsTag()",
  "ExtraArgOutOfOrderExecutionMustBeTrue()",
  "OnlyCallableByOwnerOrAdmin()",
  "OnlyCallableByOwnerOrAdminOrNop()",
  "InvalidWithdrawParams()",
  "NoFeesToPay()",
  "NoNopsToPay()",
  "InsufficientBalance()",
  "TooManyNops()",
  "MaxFeeBalanceReached()",
  "MessageTooLarge(uint256,uint256)",
  "MessageGasLimitTooHigh()",
  "UnsupportedNumberOfTokens()",
  "UnsupportedToken(address)",
  "MustBeCalledByRouter()",
  "RouterMustSetOriginalSender()",
  "InvalidConfig()",
  "CursedByRMN()",
  "LinkBalanceNotSettled()",
  "InvalidNopAddress(address)",
  "NotAFeeToken(address)",
  "CannotSendZeroTokens()",
  "SourceTokenDataTooLarge(address)",
  "InvalidChainSelector(uint64)",
  "GetSupportedTokensFunctionalityRemovedCheckAdminRegistry()",
  "InvalidDestBytesOverhead(address,uint32)",

  // Router
  "FailedToSendValue()",
  "InvalidRecipientAddress(address)",
  "OffRampMismatch(uint64,address)",
  "BadARMSignal()",

  // token admin registry
  "OnlyRegistryModuleOrOwner(address)",
  "OnlyAdministrator(address,address)",
  "OnlyPendingAdministrator(address,address)",
  "AlreadyRegistered(address)",
  "ZeroAddress()",
  "InvalidTokenPoolToken(address)",

  // Cutsom
  "CanOnlySelfRegister(address,address)",
  "RequiredRoleNotFound(address,bytes32,address)",
  "AddressZero()",
];

const errorMap: Record<string, string> = {};
for (const err of errors) {
  const selector = keccak256(toUtf8Bytes(err)).slice(0, 10);

  errorMap[selector] = err;
}

for (const targetSelector of targetSelectors) {
  const matchedError = errorMap[targetSelector];
  if (matchedError) {
    console.log(`MATCH with ${targetSelector}: ${matchedError}`);
  } else {
    console.log(`No match for target selector: ${targetSelector}`);
  }
}
