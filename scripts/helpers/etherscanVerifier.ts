import hre from "hardhat";

hre.run("verify:verify", {
    address: "0xA83Cd07FbEa2FD512DEb97B6145FF3bC470f450E",
    constructorArguments: [
        "invest.lapetiteepicerie.ch",
        [
            "0xb99ea8EA3dBC21104bd6Dec253e6587BAB425cb2",
            7500,
            5010,
            5184000
        ],
        "0x5e200B3C6e9ce8280dbB14A0E5486895456136EF",
        "0x9eA6427f76b27F939942941fFbA43667F4e2a45c",
        "0x4119a84bF63dAD56aE2daE7697C22a7De09b1E12",
        "0xd3DE54d9e424BF27b8259E69B205127722c771Cb"
    ],
  });
