// AUTO-GENERATED snapshot of buggy MultichainWallet signer sets to migrate.
// Source: prod /team endpoint, cross-verified against on-chain SignerChange logs + live
// signers()/signerCount() reads (all three agreed, 0 diffs). Snapshot 2026-08-16.
// Scope: 15 confirmed-real companies + skribble, aktionariat-sec, showcaseag (18 total).
// Signer sets were identical across mainnet/optimism/polygon at snapshot time.
// Regenerate if signer sets may have changed before running the migration.

export type AffectedCompany = {
  name: string; id: number; tier: "prod" | "TEST"; priority: boolean;
  oldMultisig: string; newMultisig: string; salt: string;
  signers: string[]; powers: number[];
};

export const AFFECTED_COMPANIES: AffectedCompany[] = [
  {
    "name": "ayon",
    "id": 62030,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x8157a05c3e8e35a01ee01d425b207ec6ec397eaa",
    "newMultisig": "0x375F0218D635FD7A4DfD547742F349DE91eBf7aB",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632303330",
    "signers": [
      "0xf4dc6190fdb96ec0668fe2e50064dd551553e399",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772",
      "0xdcaa50578efe0a2ab95767a6dc41d104d543e8d9"
    ],
    "powers": [
      1,
      1,
      1
    ]
  },
  {
    "name": "beemotion",
    "id": 60103,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x02b3739ebe45822b5573a5870b84834db52b9b6c",
    "newMultisig": "0x3d270c8F65F9cc895f6444509C208Ef503949423",
    "salt": "0x3030303030303030303030303030303030303030303030303030303630313033",
    "signers": [
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      1
    ]
  },
  {
    "name": "caveo",
    "id": 65382,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x2dc06360f974c405db82c1952b282846a93f84ad",
    "newMultisig": "0xbd0d691d2784975d7c3cD9F12e37C7B3Fb2027C2",
    "salt": "0x3030303030303030303030303030303030303030303030303030303635333832",
    "signers": [
      "0xfdab03993c94580b225dcbf4dfd42f4e81223a6a",
      "0xa24658354bedbf85c85d70a8ffde8c6cc67136fd",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      2,
      2,
      1
    ]
  },
  {
    "name": "funere",
    "id": 66298,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x9450faf3f3881b86d485b121f59e3946b8aeda88",
    "newMultisig": "0xEfd808495CC8C112914BA8B181B75dD2f9809233",
    "salt": "0x3030303030303030303030303030303030303030303030303030303636323938",
    "signers": [
      "0xda70cbae244c9c882c2adb4ba5c0e581121d211d",
      "0x190fd353e849f073a95f4f842ed5050345345d67",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      1,
      1,
      1
    ]
  },
  {
    "name": "licorn",
    "id": 57846,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x3a3c22eee11bcc8877a81739e2fc42809587e7c5",
    "newMultisig": "0xa3BE8358e55bF0cf5d0736DedBdb31eB14b2dAEe",
    "salt": "0x3030303030303030303030303030303030303030303030303030303537383436",
    "signers": [
      "0xf504fabbc6770b313f6419ce8f8daa8666deee6e",
      "0xffb6088ef41ac585dda97f2bdb1c55b21755e589",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      2,
      2,
      1
    ]
  },
  {
    "name": "lighthousetech",
    "id": 66734,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x04ada1bd2162d61c57b9165b6b1d241baf2a942c",
    "newMultisig": "0xd14a1f5a60b9cBA97159CC8EDA41516FaF23ca3E",
    "salt": "0x3030303030303030303030303030303030303030303030303030303636373334",
    "signers": [
      "0xd817eaedf179ba9d9868f6f3d84c7345a41914f4",
      "0x635da7b4fa08a54e33bbdc00d84e60d5c65992a9",
      "0x21ef7bf0316475a522f7239611b5a8b7cff61a31",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      2,
      2,
      2,
      1
    ]
  },
  {
    "name": "meissereconomics",
    "id": 2468,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x4979b5fb5b43663285e6e22bf5a6190447f9f4ee",
    "newMultisig": "0x853b7B604A0C1ac2EB9AdF1dBb209dE66dDBb0b3",
    "salt": "0x3030303030303030303030303030303030303030303030303030303032343638",
    "signers": [
      "0xf36b52ec5e7b66897ff6640d263b21a991f4131c"
    ],
    "powers": [
      1
    ]
  },
  {
    "name": "onesto",
    "id": 59504,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0xc754ada0856dcf573b7d5f4770d374802a05ead4",
    "newMultisig": "0xadbFbe6553dBC728017243fdE7F3f49937D2809B",
    "salt": "0x3030303030303030303030303030303030303030303030303030303539353034",
    "signers": [
      "0xb30657e7c4a5af202e560a568b06b96f59e0c2dc",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      1,
      1
    ]
  },
  {
    "name": "oomnium",
    "id": 48006,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0xdd1883b947ee855c6eccbd743fee37bcf17257bb",
    "newMultisig": "0x52BE207a8CcD9332365BBB715529b8793AbBa942",
    "salt": "0x3030303030303030303030303030303030303030303030303030303438303036",
    "signers": [
      "0x3be7434299adf25b978deb7b3ec0cc1d6f408481"
    ],
    "powers": [
      1
    ]
  },
  {
    "name": "perivision",
    "id": 60434,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x96def53d3f53b7b9f1fbe54efddc2f4cfd4d3d84",
    "newMultisig": "0x00673a918faccBd554Fa0c37856D86E3592e1Dd9",
    "salt": "0x3030303030303030303030303030303030303030303030303030303630343334",
    "signers": [
      "0x30ae499f888ca41b21e0f2ecf362fa899c19b238",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772",
      "0xf7e68a96e6e5bab46b4b54907b1e2c07333c072e"
    ],
    "powers": [
      1,
      1,
      1
    ]
  },
  {
    "name": "skribble",
    "id": 68669,
    "tier": "prod",
    "priority": false,
    "oldMultisig": "0xb17bbda99ba670e6f785749b9f81a5abead12f88",
    "newMultisig": "0xEB115415cBeB5c6f5D747E6fD7e1a4e031cC087E",
    "salt": "0x3030303030303030303030303030303030303030303030303030303638363639",
    "signers": [
      "0xdcaa50578efe0a2ab95767a6dc41d104d543e8d9"
    ],
    "powers": [
      1
    ]
  },
  {
    "name": "sonix",
    "id": 61438,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x5faf3ccd8180725c42114a455abdd1abafaa990a",
    "newMultisig": "0x7a4916020101822939401fe23932A5C84B97c6bb",
    "salt": "0x3030303030303030303030303030303030303030303030303030303631343338",
    "signers": [
      "0xcec4cabd1621c14410219da84e253645910c247a",
      "0xe857e5d77f8715e80562f1b09f90956ff2cc093d",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      1,
      2,
      1
    ]
  },
  {
    "name": "swisschainholding",
    "id": 64000,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0xaa95dcbc18f5dca4aa8799daa7acf29b28c1b604",
    "newMultisig": "0x4Add5D617C311AFd43485D7E6270C3edeCc67E32",
    "salt": "0x3030303030303030303030303030303030303030303030303030303634303030",
    "signers": [
      "0x09ef1b49137baed9cf287bcd5aafc42b7843ae80",
      "0xacb55f15e8247746eeb2773b6ec75281ae9bddb0",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      2,
      2,
      1
    ]
  },
  {
    "name": "transalpes",
    "id": 63907,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0xda0b338dc007b59e6cc8317ca3495089b320ae9c",
    "newMultisig": "0x2ed6C410660B1a2060de4405469d617715c3b11B",
    "salt": "0x3030303030303030303030303030303030303030303030303030303633393037",
    "signers": [
      "0xa0448e2f7e47c9a33e897f90a0591b3b822bab6d",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772"
    ],
    "powers": [
      1,
      1
    ]
  },
  {
    "name": "tribusurbaines-64281",
    "id": 64281,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x9122ddd4bed618833ffa6dd78d9ecd450517066e",
    "newMultisig": "0x891DF6b6ed356d4d07c21a016eF5D07459Fee201",
    "salt": "0x3030303030303030303030303030303030303030303030303030303634323831",
    "signers": [
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772",
      "0x0a3c14e4d2caacd208b724324f7dd99910f346c7"
    ],
    "powers": [
      1,
      1
    ]
  },
  {
    "name": "wildbieneundpartner",
    "id": 58400,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x560e978efd57ca987e0c953d3837f1fb9e69fe21",
    "newMultisig": "0x99C8fa9274B0781cc8308f1040e0eC13b90058f6",
    "salt": "0x3030303030303030303030303030303030303030303030303030303538343030",
    "signers": [
      "0x1e1595c5f9da7bf6214872e36acc4aabcfd946c5",
      "0xb40429ec942564a8ea0be1dbbcb9f53fa46ca38b",
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772",
      "0xa21eb47f9d60bb254ab5364a1f4a1b24af2c3e8a",
      "0xa1eca1f7952b141310b62f87c81ec14b9fe77fae"
    ],
    "powers": [
      2,
      2,
      1,
      2,
      1
    ]
  },
  {
    "name": "aktionariat-sec",
    "id": 64888,
    "tier": "TEST",
    "priority": false,
    "oldMultisig": "0x0ab9345ff4fbddcbfc6f31ab8a4d4cd06adece39",
    "newMultisig": "0xF9f171122A728Cb5510F43f1Dd871ceee65227fC",
    "salt": "0x3030303030303030303030303030303030303030303030303030303634383838",
    "signers": [
      "0xdcaa50578efe0a2ab95767a6dc41d104d543e8d9"
    ],
    "powers": [
      1
    ]
  },
  {
    "name": "showcaseag",
    "id": 65450,
    "tier": "TEST",
    "priority": false,
    "oldMultisig": "0xb40b89e4efef694d5f7c82e3a7cec72c718e1ddc",
    "newMultisig": "0x850f8e8938Ee54ee9A9ABD70d184C898737fbA14",
    "salt": "0x3030303030303030303030303030303030303030303030303030303635343530",
    "signers": [
      "0xdcaa50578efe0a2ab95767a6dc41d104d543e8d9"
    ],
    "powers": [
      1
    ]
  },
  {
    "name": "docjo",
    "id": 62474,
    "tier": "prod",
    "priority": true,
    "oldMultisig": "0x53b75ea6fa0250d36409ec682fc282af089d0de8",
    "newMultisig": "0x282Df87B628E202Fb51Be8c757066D163632B39C",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632343734",
    "signers": [
      "0x4651e7d54bd93b6acee700d9ec1e7dc382cf0772",
      "0xa531dc1f72ab0d1d21cbcb53f58459efe3c8454c",
      "0x757bba4032d2b313909e91c7623804bf4beb0a93",
      "0x251a7c515038b1af283cc08adec621445b03ac1d",
      "0xca185f792bb4ac012e25668948b4fd1708426ed7"
    ],
    "powers": [1, 2, 2, 2, 1]
  }
];
