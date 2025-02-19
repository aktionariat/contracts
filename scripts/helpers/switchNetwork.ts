import { network } from "hardhat";
import KEYS from "../../KEYS";

export async function switchForkedNetwork(networkName: string) {
    let forkURL: string;

    switch (networkName) {
        case "mainnet": forkURL = KEYS.alchemy.mainnet; break;
        case "optimism": forkURL = KEYS.alchemy.optimism; break;
        case "polygon": forkURL = KEYS.alchemy.polygon; break;
        case "base": forkURL = KEYS.alchemy.base; break;
        default: forkURL = KEYS.alchemy.mainnet; break;
    }
    
    await network.provider.request({
        method: "hardhat_reset",
        params: [{
            forking: {
                jsonRpcUrl: forkURL
            }
        }],
    });
}


