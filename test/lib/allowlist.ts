import { ERC20Allowlistable } from "../../types/ethers-contracts/index.ts";
import { expect } from "chai";

export async function expectUserToBeFree(
  token: ERC20Allowlistable,
  user: string
) {
  expect(await token.isRestricted(user)).to.equal(false);
  expect(await token.isAllowed(user)).to.equal(false);
  expect(await token.isAdmin(user)).to.equal(false);
}
