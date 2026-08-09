import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

export const deployFactoryShareTask = task(
  "deploy-factory-share",
  "Deploys Shares, SHA and bSHA tokens, adds them to the CCIP infrastructure. If needed deploys also factories on both source and destinations."
)
  .addOption({
    name: "source",
    description: "Source Chain to operate in.",
    type: ArgumentType.STRING,
    defaultValue: "sepolia",
  })
  .addOption({
    name: "destination",
    description:
      "Destination Chain to operate in, of format: [net]-[net]-...-[net]",
    type: ArgumentType.STRING,
    defaultValue: "baseSepolia",
  })
  .addOption({
    name: "sha",
    description: "Already deployed source chain SahresUnderAgreement Contract",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "bsha",
    description:
      "Already deployed destination chain BridgedSharesUnderAgreement Contract",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "nonce",
    description: "Whether to increase the salt's nonce",
    type: ArgumentType.FLAG,
    defaultValue: false,
  })
  .setAction(() => import("./deployment/aktionariatSharesInfrastructure.ts"))
  .build();
