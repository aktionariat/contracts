import { Contract } from "ethers";

export async function checkBrokerbotSetting(brokerbot: Contract, setting: bigint): Promise<Boolean> {
    const settings = await brokerbot.settings();
    return (settings & setting) == setting;
}