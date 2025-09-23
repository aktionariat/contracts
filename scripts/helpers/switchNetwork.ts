import KEYS from "../../KEYS.ts";
import { NetworkConnection } from "hardhat/types/network";

export async function switchForkedNetwork(connection: NetworkConnection, networkName: string) {
    let forkURL: string;

    switch (networkName) {
        case "mainnet": forkURL = KEYS.alchemy.mainnet; break;
        case "optimism": forkURL = KEYS.alchemy.optimism; break;
        case "polygon": forkURL = KEYS.alchemy.polygon; break;
        case "base": forkURL = KEYS.alchemy.base; break;
        default: forkURL = KEYS.alchemy.mainnet; break;
    }
    
    await connection.provider.request({
        method: "hardhat_reset",
        params: [{
            forking: {
                jsonRpcUrl: forkURL
            }
        }],
    });
}


