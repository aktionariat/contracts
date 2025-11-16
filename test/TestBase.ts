import hre from "hardhat";

export const connection = await hre.network.connect();
export const provider = connection.provider;
export const ethers = connection.ethers;
export const [deployer, owner, signer1, signer2, signer3, signer4, signer5, signer6, signer7] = await ethers.getSigners();
