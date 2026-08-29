/**
 * Tests are dedicateed to routing function through uniswap V3.
 * Function of interest are:
 *
 * - payFromOtherCurrencyAndNotify
 * 		Pays shares with any ERC20 token that can be routed through uniswap to the base token of DirectInvestment.
 *
 * - payFromEtherAndNotify
 * 		Pays shares with gas ETH if it can be routed through uniswap to the base token of DirectInvestment.
 *
 * From PaymentHub contract.
 */
import { network } from "hardhat";
import type { NetworkConnection } from "hardhat/types/network";

import { Contract } from "ethers";
import type { BigNumberish, Signer } from "ethers";

import { expect } from "chai";

// Abis, Interfaces
// legacy quoter and router as sol implements those
import V3PoolJson from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json" with { type: 'json' };
import WETHJson from "../artifacts/contracts/investment/IUniswapV3.sol/IWETH9.json" with { type: 'json' };
const PATH_IERC20 = "contracts/ERC20/IERC20.sol:IERC20";

// Addresses
import { ZCHF_ADDRESS } from "./Fixtures.ts";
const WBTC_ADDRESS = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

/**
 * List of all possible external tokens to be used within routing to buy shares.
 * The list is as follows:
 *
 * imperFunder_ADDRESS: "0x...",
 *    the address we can impersonificate to fund the investor address with the external token.
 *
 * imperFunder_AMOUNT: number,
 *    the amount of token to be sent to the investor from the impersonificated address. Note that
 *    as shares increase in price as the investor buys them you need to account for such increase,
 *    we recommend to fund with an amount of 1000.- with an increase of 200.- for each new token,
 *    increase is cumulative by order of keys definition. Consider it with no decimals, the decimal
 *    normalization is taken care of.
 *
 * It is important to note that for imperFunder_ADDRESS and imperFunder_AMOUNT you need to consider
 * quantities and prices of block 25464800.
 *
 * address: "0x.."
 *    the address of the external token.
 *
 * path: ["address", "uint24", "address", "uint24", "address", ...],
 *    where the first address is the output token, the last address the input token
 *    and the "unit24" is the fee of the pool between the two adjacent token addresses.
 *    Note: you need to follow exactOutput format, so from the out token to the input token.
 *
 * pools: ["0x...", "0x..."],
 *    the address of pools that are used within the path, following also the same order.
 */
type ExternalTokenName = "WETH" | "WBTC" | "USDC" | "USDT" | "DAI";

type Address = `0x${string}`;
type V3Path = `0x${string}` | `${number}`;

type ExternalToken = {
  imperFunder_ADDRESS: Address;
  imperFunder_AMOUNT: number;
  address: Address;
  path: V3Path[];
  pools: Address[];
};

type ExternalTokens<T extends string> = {
  [K in T]: ExternalToken;
};

// Recurrent elements within external tokens paths
const PATH_FROM_USDT_TO_ZCHF_UNIV3: V3Path[] = [
  "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
  "100", // https://app.uniswap.org/explore/pools/ethereum/0x8E4318E2cb1ae291254B187001a59a1f8ac78cEF
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
];
const POOL_USDT_ZCHF_UNIV3: Address =
  "0x8E4318E2cb1ae291254B187001a59a1f8ac78cEF";

const EXTERNAL_TOKENS: ExternalTokens<ExternalTokenName> = {
  // WETH: works only for direct payment with gas ether
  WETH: {
    imperFunder_ADDRESS: "0x4b7fEcEffE3b14fFD522e72b711B087f08BD98Ab",
    imperFunder_AMOUNT: 10,

    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",

    path: [
      ...PATH_FROM_USDT_TO_ZCHF_UNIV3,
      "500", // https://app.uniswap.org/explore/pools/ethereum/0x11b815efB8f581194ae79006d24E0d814B7697F6
      // "3000", // https://app.uniswap.org/explore/pools/ethereum/0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36   If price impact drawback exceedes swapped fees, this could be better
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    ],
    pools: [POOL_USDT_ZCHF_UNIV3, "0x11b815efB8f581194ae79006d24E0d814B7697F6"],
  },

  // BTC
  WBTC: {
    imperFunder_ADDRESS: "0x652356478073bA1D38b310850446d0A4C3Cad4BD",
    imperFunder_AMOUNT: 10,

    address: WBTC_ADDRESS,

    path: [
      ...PATH_FROM_USDT_TO_ZCHF_UNIV3,
      "500", // https://app.uniswap.org/explore/pools/ethereum/0x56534741CD8B152df6d48AdF7ac51f75169A83b2?chart=liquidity
      // "3000", // http://app.uniswap.org/explore/pools/ethereum/0x9Db9e0e53058C89e5B94e29621a205198648425B
      WBTC_ADDRESS,
    ],
    pools: [POOL_USDT_ZCHF_UNIV3, "0x56534741CD8B152df6d48AdF7ac51f75169A83b2"],
  },

  // Stablecoins
  USDC: {
    imperFunder_ADDRESS: "0x01b8697695EAb322A339c4bf75740Db75dc9375E",
    imperFunder_AMOUNT: 10_000,

    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",

    path: [
      ...PATH_FROM_USDT_TO_ZCHF_UNIV3,
      "100", // https://app.uniswap.org/explore/pools/ethereum/0x3416cF6C708Da44DB2624D63ea0AAef7113527C6
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ],
    pools: [POOL_USDT_ZCHF_UNIV3, "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6"],
  },
  USDT: {
    imperFunder_ADDRESS: "0x3fe705e2FFcaEe8d7287de047DeF35Db3e794C76",
    imperFunder_AMOUNT: 10_000,

    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",

    path: PATH_FROM_USDT_TO_ZCHF_UNIV3,
    pools: [POOL_USDT_ZCHF_UNIV3],
  },
  DAI: {
    imperFunder_ADDRESS: "0x415D8D075CAcB5A61Ae854A8e5ea53DF3A76F688",
    imperFunder_AMOUNT: 10_000,

    address: "0x6b175474e89094c44da98b954eedeac495271d0f",

    path: [
      ...PATH_FROM_USDT_TO_ZCHF_UNIV3,
      "100", // https://app.uniswap.org/explore/pools/ethereum/0x48DA0965ab2d2cbf1C17C09cFB5Cbe67Ad5B1406
      "0x6b175474e89094c44da98b954eedeac495271d0f",
    ],
    pools: [POOL_USDT_ZCHF_UNIV3, "0x48DA0965ab2d2cbf1C17C09cFB5Cbe67Ad5B1406"],
  },
};

interface InvestmentAktionariatContracts {
  directInvestment: Contract;
  paymentHub: Contract;
}

/**
 * Impersonificate adress from on the network to transfer quantity of tokenToTransfer to address to
 *
 * @param connection hardhat connection
 * @param from the address to transfer from
 * @param to the address to transfer to
 * @param tokenToTransfer the token to transfer
 * @param quantity the quantity to transfer
 */
async function impersonificateAndTransferToken(
  connection: NetworkConnection,
  from: string,
  to: string,
  tokenToTransfer: string,
  quantity: BigNumberish
) {
  // we impersonate an address to fund owned addresses with tokenToTransfer
  await connection.provider.request({
    method: "hardhat_impersonateAccount",
    params: [from],
  });
  const imperFunder = await connection.ethers.getSigner(from);

  const token = await connection.ethers.getContractAt(
    PATH_IERC20,
    tokenToTransfer
  );

  // transfter token to "to"
  // @ts-expect-error
  await token.connect(imperFunder).transfer(to, quantity);

  // stop impersonating
  await connection.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [from],
  });
}

/**
 * Deploys th Aktionariat direct investment suite: DirectInvestment and PaymentHub contracts
 *
 * @param connection hardhat connection
 * @param deployer the deployer address
 * @param shareToken the share token of DirectInvestment
 * @param price the price of shares
 * @param increment the increment of shares price
 * @param base the base token used to buy shares
 * @param quoter the Uniswap V3 quoter address
 * @param swapRouter the Uniswap V3 router address
 * @returns
 */
async function deployInvestmentAktionariatSuide(
  connection: NetworkConnection,
  deployer: Signer,

  shareToken: string,
  price: BigNumberish,
  increment: BigNumberish,
  base: string,

  quoter: string,
  swapRouter: string
): Promise<InvestmentAktionariatContracts> {
  let ethers = connection.ethers;
  // shares token
  // either we deploy mock erc20, but we need to make a pool on uni: we can also use Shares
  //        we impersonificate a whale with a token and zchf and transfer funds: we can fix tests by choosing block
  // we choose latter and pass them as arguments

  const PaymentHub = await ethers.getContractFactory("PaymentHub");
  // address _owner,
  // IQuoter _uniswapV3Quoter,
  // ISwapRouter _uniswapV3SwapRouter
  const paymentHub = await PaymentHub.connect(deployer).deploy(
    deployer,
    quoter,
    swapRouter
  );
  await paymentHub.waitForDeployment();

  const DirectInvestment = await ethers.getContractFactory("DirectInvestment");
  // IERC20 _token,
  // uint256 _price,
  // uint256 _increment,
  // IERC20 _base,
  // address _owner,
  // address _paymentHub
  const directInvestment = await DirectInvestment.connect(deployer).deploy(
    shareToken,
    price,
    increment,
    base,
    deployer,
    paymentHub
  );
  await directInvestment.waitForDeployment();

  return {
    directInvestment: directInvestment as unknown as Contract,
    paymentHub: paymentHub as unknown as Contract,
  };
}

/**
 * Computes from the stored Uniswap sqrtPriceX96 the price in unit256 (bigint) normalized by decimal
 * To maintain precision we scale division by 18 decimals, so you get `price * 10n ** 18n`
 *
 * @param slot0 Uniswap Pool response from slot0() view function
 * @param decimals0 decimals of the over token
 * @param decimals1 decimals of the under token
 * @returns price in unit256 (bigint) normalized by decimal
 */
function getPriceFromPool(
  slot0: { sqrtPriceX96: bigint },
  decimals0: bigint,
  decimals1: bigint
): bigint {
  const Q192 = 2n ** 192n;

  const numerator = slot0.sqrtPriceX96 * slot0.sqrtPriceX96 * 10n ** decimals0;

  const denominator = Q192 * 10n ** decimals1;

  return (numerator * 10n ** 18n) / denominator;
}

/**
 * Queries each pool token for decimal and returns it
 *
 * @param POOL the uniswap V3 AMM Contract of the pool
 * @returns both tokens decimal
 */
async function getDecimalsPool(
  POOL: Contract,
  ethers: any
): Promise<{ decimal0: bigint; decimal1: bigint }> {
  const TOKEN0_ADDRESS = await POOL.token0();
  const TOKEN1_ADDRESS = await POOL.token1();
  return {
    decimal0: await (
      await ethers.getContractAt(PATH_IERC20, TOKEN0_ADDRESS)
    ).decimals(),
    decimal1: await (
      await ethers.getContractAt(PATH_IERC20, TOKEN1_ADDRESS)
    ).decimals(),
  };
}

/**
 * Computes whether the swap needs to be reverted or not from addresses
 *
 * @param tokenIn address of token to be swapped
 * @param tokenOut address of token to return after swap
 * @param token0 address of token0
 * @param token1 address of token1
 * @returns whether the swap needs to be reverted or not
 */
function getPoolDirection(
  tokenIn: string,
  tokenOut: string,
  token0: string,
  token1: string
) {
  if (
    tokenIn.toLowerCase() === token0.toLowerCase() &&
    tokenOut.toLowerCase() === token1.toLowerCase()
  ) {
    return false;
  }

  if (
    tokenIn.toLowerCase() === token1.toLowerCase() &&
    tokenOut.toLowerCase() === token0.toLowerCase()
  ) {
    return true;
  }

  throw new Error("Pool does not contain requested pair");
}

/**
 * From a list of UniswapV3 pools, and expected output quantity it computes the expected amount in.
 * It expects the path to be in the EACT_OUTPUT format.
 * It expects pools to be correctly chained
 *
 * @param path the UniswapV3 pools path
 * @param amountOut the expected amount out
 * @return returns the expected amount in
 */
async function getExpectedAmountIn(
  ethers: any,
  path: V3Path[],
  pools: Address[],
  amountOut: bigint
): Promise<bigint> {
  // path holds the same as pools but token and fees wise
  const no_fees_path = path.filter((v) => v.startsWith("0x"));

  let amountIn = 0n;
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    const V3Pool = new ethers.Contract(pool, V3PoolJson.abi, ethers.provider);

    const slot0 = await V3Pool.slot0();
    const decimalsPool = await getDecimalsPool(V3Pool, ethers);

    // extract price in bigint WETH/USDC
    let real_price = getPriceFromPool(
      slot0,
      decimalsPool.decimal0,
      decimalsPool.decimal1
    );

    // to make it decimal aware here requires more then needed
    const PRICE_SCALE = 10n ** 18n;
    let price = real_price;

    if (
      !getPoolDirection(
        no_fees_path[i + 1],
        no_fees_path[i],
        await V3Pool.token0(),
        await V3Pool.token1()
      )
    ) {
      price = (PRICE_SCALE * PRICE_SCALE) / price;
    }

    // recursively compute cost
    amountIn = ((amountIn == 0n ? amountOut : amountIn) * price) / PRICE_SCALE;
  }

  return amountIn;
}

describe("Routing on forked Mainnet", () => {
  let connection: NetworkConnection;

  const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

  const Quoter_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const SwapRouter_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  const WETH9_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  let WETH9: Contract;

  let zchf: Contract;

  const shareToken_ADDRESS = "0xae78736Cd615f374D3085123A210448E74Fc6393";
  let shareToken: Contract;
  const SHARES_TO_BUY = 5;
  const SHARE_COST = 10;
  const SHARE_INCREASE = 5;

  const imperFunder_ADDRESS = "0xC249626c215d1788942240bba86FcC95FD138a30";

  let akt_deployer: Signer;
  let aktSuite: InvestmentAktionariatContracts;

  let uni_deployer: Signer;

  let investor: Signer;
  let investor2: Signer;

  before(async () => {
    // This test uses the forked Mainnet network (ETH mainnet)
    connection = await network.create("mainnetForkAtBlock25464800");
    let ethers = connection.ethers;

    [akt_deployer, uni_deployer, investor, investor2] =
      await ethers.getSigners();

    // read zchf: base token
    zchf = await ethers.getContractAt(PATH_IERC20, ZCHF_ADDRESS);

    // read rETH: share token
    shareToken = await ethers.getContractAt(PATH_IERC20, shareToken_ADDRESS);

    // we impersonate an address to fund owned addresses with zchf and share token
    // zchf has decimal of 18
    impersonificateAndTransferToken(
      connection,
      imperFunder_ADDRESS,
      await akt_deployer.getAddress(),
      await zchf.getAddress(),
      ethers.parseUnits("1000", 18)
    );
    // shares have decimal of 0
    impersonificateAndTransferToken(
      connection,
      imperFunder_ADDRESS,
      await akt_deployer.getAddress(),
      await shareToken.getAddress(),
      1000n
    );

    WETH9 = new ethers.Contract(WETH9_ADDRESS, WETHJson.abi, uni_deployer);

    aktSuite = await deployInvestmentAktionariatSuide(
      connection,
      akt_deployer,
      await shareToken.getAddress(),
      ethers.parseUnits(SHARE_COST.toString(), 18),
      ethers.parseUnits(SHARE_INCREASE.toString(), 18),
      await zchf.getAddress(),
      Quoter_ADDRESS,
      SwapRouter_ADDRESS
    );
  });

  it("should fund DirectInvestment, see price for shares and notify transfer", async function () {
    let ethers = connection.ethers;

    // // funding direct investment
    // 500 rETH shares at 0 decimal
    await expect(
      shareToken
        .connect(akt_deployer)
        // @ts-expect-error
        .transfer(await aktSuite.directInvestment.getAddress(), 500n)
    ).to.changeTokenBalance(
      ethers,
      shareToken,
      await aktSuite.directInvestment.getAddress(),
      500n
    );

    // // price check
    // compute price naively
    let price = 0;
    let priceAfter = SHARE_COST + SHARES_TO_BUY * SHARE_INCREASE;
    for (let i = 0; i < SHARES_TO_BUY; i++) {
      price = price + SHARE_COST + i * SHARE_INCREASE;
    }

    let normPrice = ethers.parseUnits(price.toString(), 18);
    expect(
      await aktSuite.directInvestment.getBuyPrice(SHARES_TO_BUY)
    ).to.be.equal(normPrice, `Price does not equal ${normPrice}`);

    // // notify check
    // address buyer,
    // uint256 amountShares,
    // uint256 amountBaseCurrency,
    // bytes calldata ref
    const ref = ethers.hexlify(ethers.toUtf8Bytes("my-ref"));

    const transfer_tx = aktSuite.directInvestment.notifyTradeAndTransfer(
      investor,
      ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
      ethers.parseUnits("10", 18), // arbitrary
      ref
    );

    await expect(transfer_tx)
      .to.emit(aktSuite.directInvestment, "Trade")
      .withArgs(
        await shareToken.getAddress(),
        await investor.getAddress(),
        ref,
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        await zchf.getAddress(),
        ethers.parseUnits("10", 18),
        0,
        ethers.parseUnits(priceAfter.toString(), 18)
      );

    await expect(transfer_tx).to.changeTokenBalances(
      ethers,
      shareToken,
      [
        await investor.getAddress(),
        await aktSuite.directInvestment.getAddress(),
      ],
      [
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        -ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
      ]
    );

    // notify all check
    const batch_transfer_tx = aktSuite.directInvestment.notifyTradesAndTransfer(
      [investor, investor2],
      [
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
      ],
      [ethers.parseUnits("10", 18), ethers.parseUnits("10", 18)], // arbitrary
      [ref, ref]
    );

    let priceAfterFirstBatchTransfer =
      priceAfter + SHARES_TO_BUY * SHARE_INCREASE;
    let priceAfterSecondBatchTransfer =
      priceAfterFirstBatchTransfer + SHARES_TO_BUY * SHARE_INCREASE;
    await expect(batch_transfer_tx)
      .to.emit(aktSuite.directInvestment, "Trade")
      .withArgs(
        await shareToken.getAddress(),
        await investor.getAddress(),
        ref,
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        await zchf.getAddress(),
        ethers.parseUnits("10", 18),
        0,
        ethers.parseUnits(priceAfterFirstBatchTransfer.toString(), 18)
      )
      .to.emit(aktSuite.directInvestment, "Trade")
      .withArgs(
        await shareToken.getAddress(),
        await investor2.getAddress(),
        ref,
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        await zchf.getAddress(),
        ethers.parseUnits("10", 18),
        0,
        ethers.parseUnits(priceAfterSecondBatchTransfer.toString(), 18)
      );

    // Final check of shares balance on contract
    expect(
      await shareToken.balanceOf(await aktSuite.directInvestment.getAddress())
    ).to.be.equal(
      ethers.parseUnits((500 - SHARES_TO_BUY * 3).toString(), 0),
      `Balance of direct investment is incorrect`
    );
  });

  it("Incorrect path should throw", async function () {
    let ethers = connection.ethers;
    const base = await zchf.getAddress();
    const weth = await WETH9.getAddress();
    const validPath = ethers.solidityPacked(["address", "uint24", "address"], [base, 3000, weth]);

    const badPaths = {
      "too short": ethers.solidityPacked(["address"], [base]),
      "bad length modulo": validPath + "00",
      "wrong base": ethers.solidityPacked(
        ["address", "uint24", "address"],
        [weth, 3000, weth]),
      "wrong payment currency": ethers.solidityPacked(
        ["address", "uint24", "address", "uint24", "address"],
        [base, 3000, base, 100, base]
      ),
    };

    for (const [reason, path] of Object.entries(badPaths)) {
      await expect(
        aktSuite.paymentHub.getPriceInPaymentCurrency.staticCall(
          await aktSuite.directInvestment.getAddress(),
          1,
          weth,
          path
        ),
        reason
      ).to.be.revertedWithCustomError(aktSuite.paymentHub, "PaymentHub_InvalidPath");
    }
  });

  it("should be able to pay with native ETH", async function () {
    let ethers = connection.ethers;

    // direct investment is funded

    // we build the path manually from WETH to ZCHF
    const ref = ethers.hexlify(ethers.toUtf8Bytes("my-ref"));

    // https://developers.uniswap.org/docs/protocols/v3/guides/swapping/multi-hop-swapping#exact-output-multihop-swap
    // Path is in reverse order as router computes starting from desired amount in output to get how much input is needed
    // For route:     TokenA -> TokenB -> TokenC
    // Encoding is:   TokenC | feeBC | TokenB | feeAB | TokenA, where TokenX is Address of 20 bytes and feeAB fees in bps as unit24 (3 bytes)
    // in solidty abi.encodepacked
    // in ethers ethers.solidityPacked(["address", "uint24", "address"], [tokenOut, 3000, tokenIn])
    //
    // price is encoded token1 / token0

    // From WETH to USDT (V3) 0.3%
    // https://app.uniswap.org/explore/pools/ethereum/0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36
    const WETH_USDT_V3POOL_ADDRESS =
      "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36";
    // From USDT to ZCHF (V3) 0.01%
    // https://app.uniswap.org/explore/pools/ethereum/0x8E4318E2cb1ae291254B187001a59a1f8ac78cEF
    const USDT_ZCHF_V3POOL_ADDRESS =
      "0x8E4318E2cb1ae291254B187001a59a1f8ac78cEF";

    const path: V3Path[] = [
      ZCHF_ADDRESS,
      "100",
      USDT_ADDRESS,
      "3000",
      (await WETH9.getAddress()) as Address,
    ];

    const packedPath = ethers.solidityPacked(
      path.map((v) => (v.startsWith("0x") ? "address" : "uint24")),
      path
    );

    // we naively compute amount needed
    let WETH_USDT_V3Pool = new ethers.Contract(
      WETH_USDT_V3POOL_ADDRESS,
      V3PoolJson.abi,
      ethers.provider
    );
    let USDT_ZCHF_V3Pool = new ethers.Contract(
      USDT_ZCHF_V3POOL_ADDRESS,
      V3PoolJson.abi,
      ethers.provider
    );

    // https://github.com/Uniswap/v3-core/blob/d0831dc6b8a318df3872b6d68f6de135c9f3ec29/contracts/interfaces/pool/IUniswapV3PoolState.sol#L21
    const resWethUsdtSlot0 = await WETH_USDT_V3Pool.slot0();
    const decimalsWethUsdt = await getDecimalsPool(WETH_USDT_V3Pool, ethers);

    // extract price in bigint WETH/USDC
    const priceWethUsdt = getPriceFromPool(
      resWethUsdtSlot0,
      decimalsWethUsdt.decimal0,
      decimalsWethUsdt.decimal1
    );

    let fpriceWethUsdt = Number(priceWethUsdt) / 1e18;
    let fpriceUsdtWeth = 1 / fpriceWethUsdt;

    let priceUsdtWeth = 10n ** 36n / priceWethUsdt;

    // console.log(`1 WETH/USDT = ${fpriceWethUsdt}`)
    // console.log(`1 USDT/WETH = ${fpriceUsdtWeth}`)
    // console.log(`1 USDT/WETH = ${priceUsdtWeth}`)

    const resUsdtZchfSlot0 = await USDT_ZCHF_V3Pool.slot0();
    const decimalsUsdtZchf = await getDecimalsPool(USDT_ZCHF_V3Pool, ethers);

    // extract price in bigint ZCHF/USDT
    const priceZchfUsdt = getPriceFromPool(
      resUsdtZchfSlot0,
      decimalsUsdtZchf.decimal0,
      decimalsUsdtZchf.decimal1
    );

    let fpriceZchfUsdt = Number(priceZchfUsdt) / 1e18;
    let fpriceUsdtZchf = 1 / fpriceZchfUsdt;

    // console.log(`1 USDT/ZCHF = ${fpriceUsdtZchf}`)
    // console.log(`1 ZCHF/USDT = ${fpriceZchfUsdt}`)

    // compute expected WETH to be spend for SHARES_TO_BUY
    // cost is
    const baseCost: bigint = await aktSuite.directInvestment.getBuyPrice(
      SHARES_TO_BUY
    );
    // console.log(`to pay: ${baseCost} in base currency (CHF * 1e18)`)

    const normalizedBaseCost =
      Number(baseCost) / Number(10n ** decimalsUsdtZchf.decimal0);
    // console.log(`to pay: ${normalizedBaseCost} normalized in base currency (CHF)`)

    // we expect to spend normalizedBaseCost of ZCHF in WETH: normalizedBaseCost ZCHF * ZCHF/USDT * USDT/WETH = WETH
    // big int math is as good as float
    const expectedWethToBeSpent =
      (((baseCost * priceZchfUsdt) / 10n ** 18n) * priceUsdtWeth) / 10n ** 18n;

    // check price
    // IDirectInvestment directInvestment,
    // uint256 amountShares,
    // IERC20 paymentCurrency,
    // bytes calldata path
    // since it is not market as view we dont send a txn but an eth_call through staticCall
    const expectedIn =
      await aktSuite.paymentHub.getPriceInPaymentCurrency.staticCall(
        await aktSuite.directInvestment.getAddress(),
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        await WETH9.getAddress(),
        packedPath
      );
    expect(expectedIn).to.be.approximately(
      expectedWethToBeSpent,
      ethers.parseUnits("0.01", 18),
      "Expected payment in WETH differs"
    );
    // approximation since we do not take into account for fees and slippage of the routing in expectedWethToBeSpent

    // beforehand approve WETH for spending
    await aktSuite.paymentHub
      .connect(investor)
      // @ts-expect-error
      .approveERC20(await WETH9.getAddress());

    // IDirectInvestment directInvestment,
    // uint256 amountShares,
    // bytes calldata path,
    // bytes calldata ref
    const trade_tx = aktSuite.paymentHub
      .connect(investor)
      // @ts-expect-error
      .payFromEtherAndNotify(
        await aktSuite.directInvestment.getAddress(),
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        packedPath,
        ref,
        {
          // then expectedIn should be used to purchase shares while the rest refunded as WETH
          value: ethers.parseUnits("1", 18),
        }
      );

    // change in shares token balance
    await expect(trade_tx).to.be.changeTokenBalances(
      ethers,
      shareToken,
      [
        await investor.getAddress(),
        await aktSuite.directInvestment.getAddress(),
      ],
      [
        ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        -ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
      ]
    );

    // expected WETH to be returned to investor
    expect(
      await WETH9.balanceOf(await investor.getAddress())
    ).to.be.approximately(
      ethers.parseUnits("1", 18) - expectedWethToBeSpent,
      ethers.parseUnits("0.01", 18),
      "returned WETH not correct"
    );

    // expect base token to be held by paymenthub after payment
    expect(
      await zchf.balanceOf(await aktSuite.directInvestment.getAddress())
    ).to.be.equal(baseCost, "returned WETH not correct");
  });

  for (let i = 0; i < Object.keys(EXTERNAL_TOKENS).length; i++) {
    const TOKEN_TICKER: ExternalTokenName = Object.keys(EXTERNAL_TOKENS)[
      i
    ] as ExternalTokenName;

    it(`should be able to find route from external token ${TOKEN_TICKER} to ZCHF`, async function () {
      // should make programmatic impersonification and external token wrapping in contract
      // and programmatic path testign within it(...)
      let ethers = connection.ethers;

      // compute path: we decided to follow hardcoded path
      const path = EXTERNAL_TOKENS[TOKEN_TICKER].path;
      const packedPath = ethers.solidityPacked(
        path.map((v) => (v.startsWith("0x") ? "address" : "uint24")),
        path
      );

      const pools = EXTERNAL_TOKENS[TOKEN_TICKER].pools;
      const externalToken_ADDRESS = EXTERNAL_TOKENS[TOKEN_TICKER].address;

      // decimal of token
      const decimals: bigint = await (
        await ethers.getContractAt(PATH_IERC20, externalToken_ADDRESS)
      ).decimals();

      // read arbitrary TOKEN_TICKER external token
      const externalToken = await ethers.getContractAt(
        PATH_IERC20,
        externalToken_ADDRESS
      );

      // external token transfer
      await impersonificateAndTransferToken(
        connection,
        EXTERNAL_TOKENS[TOKEN_TICKER].imperFunder_ADDRESS,
        await investor.getAddress(),
        externalToken_ADDRESS,
        ethers.parseUnits(
          EXTERNAL_TOKENS[TOKEN_TICKER].imperFunder_AMOUNT.toString(),
          decimals
        )
      );

      const directInvestmentBaseBalance: bigint = await zchf.balanceOf(
        await aktSuite.directInvestment.getAddress()
      );
      const cost: bigint = await aktSuite.directInvestment.getBuyPrice(
        SHARES_TO_BUY
      );
      const balanceInvestorExternalTokens: bigint =
        await externalToken.balanceOf(await investor.getAddress());

      // either we clamp it to decimals or we compute it decimal aware
      const expectedExternalTokenToBeSpent_e18 = await getExpectedAmountIn(
        ethers,
        path,
        pools,
        cost
      );
      // we clamp it to exact decimal:
      const expectedExternalTokenToBeSpent =
        expectedExternalTokenToBeSpent_e18 / 10n ** (18n - decimals);

      // compute prevented cost
      // returned in externalToken_ADDRESS decimals
      const expectedIn =
        await aktSuite.paymentHub.getPriceInPaymentCurrency.staticCall(
          await aktSuite.directInvestment.getAddress(),
          ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
          externalToken_ADDRESS,
          packedPath
        );
      expect(expectedIn).to.be.approximately(
        expectedExternalTokenToBeSpent,
        // decimality approximation depends on external token decimals
        expectedExternalTokenToBeSpent / 100n,
        `Expected payment in ${TOKEN_TICKER} differs`
      );

      // Approve the external payment token from the investor to the PaymentHub.
      await externalToken
        .connect(investor)
        //@ts-expect-error
        .approve(
          await aktSuite.paymentHub.getAddress(),
          balanceInvestorExternalTokens * 10n
        );

      // Approve the router to spend the external token from PaymentHub.
      if (TOKEN_TICKER == "USDT") {
        await aktSuite.paymentHub.silentApproveERC20(externalToken_ADDRESS);
      } else {
        await aktSuite.paymentHub.approveERC20(externalToken_ADDRESS);
      }

      // we swap external token for shares
      const ref = ethers.hexlify(ethers.toUtf8Bytes("my-ref"));
      const trade_tx = aktSuite.paymentHub
        .connect(investor)
        // @ts-expect-error
        .payFromOtherCurrencyAndNotify(
          await aktSuite.directInvestment.getAddress(),
          ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
          // IERC20 paymentCurrency,
          externalToken_ADDRESS,
          // uint256 amountInMaximum
          // amount gets depsoited beforehand, so it should be greater than expected payment but less than or equal to
          // capacity to be spent
          balanceInvestorExternalTokens,
          packedPath,
          ref
        );

      // After transfer balances

      // change in shares token balance
      await expect(trade_tx).to.be.changeTokenBalances(
        ethers,
        shareToken,
        [
          await investor.getAddress(),
          await aktSuite.directInvestment.getAddress(),
        ],
        [
          ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
          -ethers.parseUnits(SHARES_TO_BUY.toString(), 0),
        ]
      );

      // expected external token to be returned to inverstor
      const approximatedDeltaExternalTokenBalance =
        balanceInvestorExternalTokens - expectedExternalTokenToBeSpent;
      expect(
        await externalToken.balanceOf(await investor.getAddress())
      ).to.be.approximately(
        approximatedDeltaExternalTokenBalance,
        approximatedDeltaExternalTokenBalance / 100n,
        `returned ${TOKEN_TICKER} not correct`
      );

      // expect base token to be held by paymenthub after payment
      expect(
        await zchf.balanceOf(await aktSuite.directInvestment.getAddress())
      ).to.be.equal(
        directInvestmentBaseBalance + cost,
        "ZCHF balance of direct investment is not correct"
      );
    });
  }
});
