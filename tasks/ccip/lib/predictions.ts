import { ethers } from "ethers";

/**
 * Predicts the address of a deployed BridgedSharesUnderAgreement contract.
 */
export function predictBridgedSharesAddress(
  deployerAddress: string,
  salt: string,
  creationBytecode: string,
  symbol: string,
  name: string,
  terms: string,
  owner: string,
  candidate = ethers.ZeroAddress
) {
  // we mimic the candidate logic that is present within the contract
  if (candidate && candidate !== ethers.ZeroAddress) {
    return candidate;
  }

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const constructorArgumentsBytecode = abiCoder.encode(
    ["string", "string", "string", "address"],
    [symbol, name, terms, owner]
  );

  const initCode = ethers.concat([
    creationBytecode,
    constructorArgumentsBytecode,
  ]);

  const initCodeHash = ethers.keccak256(initCode);
  return ethers.getCreate2Address(deployerAddress, salt, initCodeHash);
}
