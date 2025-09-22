import hre from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";

export async function getImpersonatedSigner(impersonatedAddress: string): Promise<HardhatEthersSigner> {
    const { provider, ethers } = await hre.network.connect();
    await provider.request({
        method: "hardhat_impersonateAccount",
        params: [impersonatedAddress],
    });
    const signer = ethers.getSigner(impersonatedAddress);
    return signer;
}