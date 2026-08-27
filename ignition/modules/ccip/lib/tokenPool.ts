/**
 * TokenPool related functions
 */
import {
  AbiCoder,
  concat,
  getCreate2Address,
  keccak256,
  solidityPacked,
} from "ethers";
import { PoolType } from "./types.ts";

/**
 * Predicts the address of a TokenPool deployed by `TokenPoolFactory.deployTokenPoolWithExistingToken`.
 *
 * @param tokenPoolFactory address of the TokenPoolFactory contract that performs the CREATE2 deployment.
 * @param salt provided CREATE2 salt passed to `deployTokenPoolWithExistingToken`.
 * @param msgSender the address that calls `deployTokenPoolWithExistingToken`.
 * @param token address of the existing ERC20 token whose tokens are bridged by this TokenPool.
 * @param localTokenDecimals number of decimals used by the local ERC20 token.
 * @param rmnProxy address of the RMN proxy contract used by the TokenPool.
 * @param ccipRouter address of the CCIP Router used by the TokenPool.
 * @param tokenPoolInitCode creation bytecode of the TokenPool implementation being deployed.
 * @param poolType type of TokenPool being deployed.
 * @returns the deterministic address at which the TokenPool will be deployed.
 */
export function predictTokenPoolAddress(
  tokenPoolFactory: string,
  salt: string,
  msgSender: string,
  token: string,
  localTokenDecimals: number,
  rmnProxy: string,
  ccipRouter: string,
  tokenPoolInitCode: string,
  poolType: PoolType
): string {
  const finalSalt = keccak256(
    solidityPacked(["bytes32", "address"], [salt, msgSender])
  );

  let constructorArgs: string;

  if (poolType === PoolType.BURN_MINT) {
    constructorArgs = AbiCoder.defaultAbiCoder().encode(
      ["address", "uint8", "address[]", "address", "address"],
      [token, localTokenDecimals, [], rmnProxy, ccipRouter]
    );
  } else if (poolType === PoolType.LOCK_RELEASE) {
    constructorArgs = AbiCoder.defaultAbiCoder().encode(
      ["address", "uint8", "address[]", "address", "bool", "address"],
      [
        token,
        localTokenDecimals,
        [],
        rmnProxy,
        // factory sets true for LOCK_RELEASE
        true,
        ccipRouter,
      ]
    );
  } else {
    throw new Error(`Unsupported pool type: ${poolType}`);
  }

  const initCodeHash = keccak256(concat([tokenPoolInitCode, constructorArgs]));
  return getCreate2Address(tokenPoolFactory, finalSalt, initCodeHash);
}
