import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import { NetworkConnection } from "hardhat/types/network";

export async function getImpersonatedSigner(impersonatedAddress: string, connection: NetworkConnection): Promise<HardhatEthersSigner> {
    await connection.provider.request({
        method: "hardhat_impersonateAccount",
        params: [impersonatedAddress],
    });
    const signer = connection.ethers.getSigner(impersonatedAddress);
    return signer;
}