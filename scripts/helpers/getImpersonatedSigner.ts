import { ethers, network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export async function getImpersonatedSigner(impersonatedAddress: string): Promise<HardhatEthersSigner> {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [impersonatedAddress],
    });
    const signer = ethers.provider.getSigner(impersonatedAddress);
    return signer;
}