import { Contract, ContractRunner } from "ethers";
import { ethers } from "hardhat";

export async function mint(shares: Contract, recipient: string, amount: bigint) {
    const owner = await shares.owner();
    const ownerSigner = await ethers.getSigner(owner);
    await shares.connect(ownerSigner).mint(recipient, amount);
}

export async function wrap(draggableShares: Contract, recipient: string, amount: bigint) {
    const recipientSigner = await ethers.getSigner(recipient);
    await draggableShares.connect(recipientSigner).wrap(recipient, amount);
}

export async function mintAndWrap(shares: Contract, draggableShares: Contract, recipient: string, amount: bigint) {
    await mint(shares, recipient, amount);
    const recipientSigner = await ethers.getSigner(recipient);
    await shares.connect(recipientSigner).approve(await draggableShares.getAddress(), amount)
    await wrap(draggableShares, recipient, amount);
}

export async function mintAndWrapByCall(shares: Contract, draggableShares: Contract, recipient: string, amount: bigint) {
    const owner = await shares.owner();
    const ownerSigner = await ethers.getSigner(owner);
    
    await shares.connect(ownerSigner).mintAndCall(recipient, await draggableShares.getAddress(), amount, "0x");
}