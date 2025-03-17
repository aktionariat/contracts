import Chance from "chance";

export function randomBigInt(min: number, max: number): bigint {
    return BigInt(new Chance().natural({ min: min, max: max }));
}