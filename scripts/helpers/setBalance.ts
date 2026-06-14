import { ethers, provider } from "../../test/TestBase.ts";

export async function setBalance(address: string, amount: bigint) {
    await provider.request({method: "hardhat_setBalance", params: [address, "0x" + amount.toString(16)]});
    await provider.request({method: "hardhat_mine"}); // Just mines to the next block
}

export async function setZCHFBalance(address: string, amount: bigint) {
    const zchfAddress = "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB";
    const zchfBalanceSlot = 0;
    setERC20Balance(zchfAddress, address, zchfBalanceSlot, amount);
}

export async function setZCHFBalancesForSigners(amount: bigint) {
    const signers = await ethers.getSigners();
    for (let i = 0; i < signers.length; i++) {
        setZCHFBalance(signers[i].address, amount);
    }
}

async function setERC20Balance(contractAddress: string, address: string, slot: number, amount: bigint) {
    const index = ethers.solidityPackedKeccak256(["uint256", "uint256"], [address, 0]);
    const amountBytesStr = ethers.toBeHex(amount, 32);
    setStorageAt(contractAddress, index, amountBytesStr);
}

export async function getStorageAt(address: string, slot: string) {
    return await provider.request({method: "eth_getStorageAt", params: [address, slot, "latest"]});
}

const setStorageAt = async (address: string, index: string, value: string) => {
    await provider.request({method: "hardhat_setStorageAt", params: [address, index, value]});
    await provider.request({method: "hardhat_mine"}); // Just mines to the next block
};


