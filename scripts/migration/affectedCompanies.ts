// AUTO-GENERATED snapshot of buggy MultichainWallet signer sets to migrate.
// Source: prod /team endpoint, cross-verified against on-chain SignerChange logs + live
// signers()/signerCount() reads (all three agreed, 0 diffs). Snapshot 2026-08-16.
// Scope: 15 confirmed-real companies + skribble, aktionariat-sec, showcaseag (18 total).
// Signer sets were identical across mainnet/optimism/polygon at snapshot time.
// Regenerate if signer sets may have changed before running the migration.

export type AffectedCompany = {
  name: string; id: number; tier: "prod" | "TEST" | "batch-nosig"; priority: boolean;
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
  },
  {
    "name": "company-4721",
    "id": 4721,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0xe719642646ccbf15efd8af1c4b823ba9db0c6908",
    "newMultisig": "0x3f39503e262254c47d0213f351fcae6017108116",
    "salt": "0x3030303030303030303030303030303030303030303030303030303034373231",
    "signers": [
      "0x102d8fe00ff2745b8a544f893090421f8768d24d"
    ],
    "powers": [1]
  },
  {
    "name": "lum",
    "id": 58899,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x1f979e2f9f43037cd02dc30718eca336ed8f6b5d",
    "newMultisig": "0x9b74a13ca5dc0a3231d71255d44ea18189a7a7c2",
    "salt": "0x3030303030303030303030303030303030303030303030303030303538383939",
    "signers": [
      "0x4ed64f2a3d186e5154fd5c54891628d8a77b91d6"
    ],
    "powers": [2]
  },
  {
    "name": "test-61392",
    "id": 61392,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x897d469b41c05a3b80c0e15b2e1baf1af8c929eb",
    "newMultisig": "0xb4a60791ad139eafd7f47e4660e97311e8bb8b93",
    "salt": "0x3030303030303030303030303030303030303030303030303030303631333932",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "test-61761",
    "id": 61761,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x72cc87fa79529c6ad70cd849cb8fded94e071331",
    "newMultisig": "0x3a56123b16a129503bc5174001ce7c96011beb6a",
    "salt": "0x3030303030303030303030303030303030303030303030303030303631373631",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "psy11",
    "id": 61830,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x4c1ee40a520a566ab80c71562ad99a0375436449",
    "newMultisig": "0x7209c052ad14cae5f1c2edb962c3a41b22c14e6d",
    "salt": "0x3030303030303030303030303030303030303030303030303030303631383330",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "test-61837",
    "id": 61837,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x981deb5be2409941c4b7104cc87598e25814ffff",
    "newMultisig": "0x073770fa4e84c6609eda6924daefadb859498972",
    "salt": "0x3030303030303030303030303030303030303030303030303030303631383337",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "che440925432",
    "id": 62082,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x921c2b1a702410550ada4babd07979d6b82f3df7",
    "newMultisig": "0x3cb5ee02be5994a688dd40aad1ddfd178a36e00e",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632303832",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "test-62084",
    "id": 62084,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x03b8f3483ad6cf01ebc6d2f9f12f86bff234d672",
    "newMultisig": "0xf547277924abfb05bf84c429e9857857f43b9f36",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632303834",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "test-62085",
    "id": 62085,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x06d5943010e87dff006db9e159ca40eb2896d897",
    "newMultisig": "0x376a4dfb58719ccd2fb6c8c7b9455d233b96ef69",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632303835",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "test-62086",
    "id": 62086,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0xbdec883a1072e386fcadb326e4c587ecaad1602d",
    "newMultisig": "0x20765ed45ced37a35e263a2cfad1ff53926fc924",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632303836",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "test-62087",
    "id": 62087,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x797bc1375a315cc4fb146a7957f4fd851b7c0453",
    "newMultisig": "0x197bb338fdb0870d7816770acae3c09ec4b3fa62",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632303837",
    "signers": [
      "0x5c157f039dceaa039bc33aa9f003a59390267644"
    ],
    "powers": [1]
  },
  {
    "name": "test-62307",
    "id": 62307,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x92c941e4c206fbc9c76164e56ea495b67cbbd3bc",
    "newMultisig": "0x819bb53dc104e123c3c400165d135a619a4c006a",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632333037",
    "signers": [
      "0xf36b52ec5e7b66897ff6640d263b21a991f4131c",
      "0x5a57dd9c623e1403af1d810673183d89724a4e0c",
      "0xfec001c6d285584ed45a7ee5a8c4684a522211f6"
    ],
    "powers": [1, 2, 2]
  },
  {
    "name": "abc",
    "id": 62667,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0xfd3534b1ffc5d4ae1c623df827201832734be0e5",
    "newMultisig": "0x77c6e66c76b43db0f87a9d47c8d27f87269edb0e",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632363637",
    "signers": [
      "0x59444cdcd324e633f7c38dec7a78974b8640c89a"
    ],
    "powers": [1]
  },
  {
    "name": "test-62904",
    "id": 62904,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x8d9677f86bdb7202d04742df0656f69fe0ccf553",
    "newMultisig": "0x4d216c27da0ccf5e290fcc3fbf7b5b24a0eadedb",
    "salt": "0x3030303030303030303030303030303030303030303030303030303632393034",
    "signers": [
      "0xf1c56ece3196d9c021cea9dfaf0962e66fcbb981"
    ],
    "powers": [1]
  },
  {
    "name": "ubs",
    "id": 63281,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0xf368e2ce73bfc356f8e967f1b29055dd88cfc1b3",
    "newMultisig": "0x31b151a20052e32f278db3c80920d37dfd1b94cd",
    "salt": "0x3030303030303030303030303030303030303030303030303030303633323831",
    "signers": [
      "0x84c8a6835cc41a11256295ca3319b0781b200ff8"
    ],
    "powers": [1]
  },
  {
    "name": "company-63471",
    "id": 63471,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x954109fcd510c2ed1edfe6dc9456a34b107b80e6",
    "newMultisig": "0x34c1b0e2d933bc30cb285632cb8c8d9d5e328193",
    "salt": "0x3030303030303030303030303030303030303030303030303030303633343731",
    "signers": [
      "0xb9158d7727d899f66f5095a4ff472b9c9444469f"
    ],
    "powers": [1]
  },
  {
    "name": "swissmediapartners",
    "id": 63499,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x26ed36cd88f0c35865db7abbece830bffabd1ad8",
    "newMultisig": "0x8872da79d153c29f2c45b6fb320e1486e2b23b62",
    "salt": "0x3030303030303030303030303030303030303030303030303030303633343939",
    "signers": [
      "0x12a011423d7e5e04022198157bcb14129e6798ff",
      "0xb8323ed9414a18910c89d6011dd6e23f043cf849"
    ],
    "powers": [2, 2]
  },
  {
    "name": "perfectdomain",
    "id": 63505,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0xc42574002258b911b70587849637e1a3e6d21dd3",
    "newMultisig": "0x9ba1ff49ba3d9a63aee03649016ad1e6cfd32396",
    "salt": "0x3030303030303030303030303030303030303030303030303030303633353035",
    "signers": [
      "0xa5a9335a1c7d65a5544bf1d911ff5c9f84c47f94"
    ],
    "powers": [2]
  },
  {
    "name": "zelemu",
    "id": 64041,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x0faaf6235a7434152cf9ad5b66b974b15fe6f858",
    "newMultisig": "0x6ee830e7ebdbcdb7a89c3700b9d2f36a499709b1",
    "salt": "0x3030303030303030303030303030303030303030303030303030303634303431",
    "signers": [
      "0xd98b95bc8f110226bf4bf87d7f4931079b970d1f"
    ],
    "powers": [1]
  },
  {
    "name": "modernsky",
    "id": 64350,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x268f720f7467524ef781d0f2a964a13408dbffeb",
    "newMultisig": "0x64977d693c787bd69ca564018cc4b6efbb9358ff",
    "salt": "0x3030303030303030303030303030303030303030303030303030303634333530",
    "signers": [
      "0x42f74d00dc6e8085f25c5c806135fe557cff568f"
    ],
    "powers": [1]
  },
  {
    "name": "cajungotshop",
    "id": 64697,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0xe8d6aef69ff5729aa50f6486058510875f41eb0c",
    "newMultisig": "0xc5bab35f9b4649a9e905ec5ac9869a212615d893",
    "salt": "0x3030303030303030303030303030303030303030303030303030303634363937",
    "signers": [
      "0xa5a9335a1c7d65a5544bf1d911ff5c9f84c47f94"
    ],
    "powers": [2]
  },
  {
    "name": "deliver",
    "id": 64728,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x628368abea8fd2e7f27eecf8f8aecaf4dada125d",
    "newMultisig": "0xd454c45cb41be61da2f43eb8cb794709fb793b8b",
    "salt": "0x3030303030303030303030303030303030303030303030303030303634373238",
    "signers": [
      "0xb8323ed9414a18910c89d6011dd6e23f043cf849",
      "0x12a011423d7e5e04022198157bcb14129e6798ff"
    ],
    "powers": [2, 2]
  },
  {
    "name": "test-65392",
    "id": 65392,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x32258088e5e1891576359b22689379ccf24a8c52",
    "newMultisig": "0x6f7e9404d96b94acb4a8dcb650ad07754eb90ca2",
    "salt": "0x3030303030303030303030303030303030303030303030303030303635333932",
    "signers": [
      "0xe1eae5c32ad8f704c70b7c39e2819eef36db89d5"
    ],
    "powers": [1]
  },
  {
    "name": "onmonetary",
    "id": 65710,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x2c2f14cc4934b0a3ce3b0af6388b0d64f06f90cf",
    "newMultisig": "0x573fb5a66e068dc673d1195d0c5d893c647b1e9d",
    "salt": "0x3030303030303030303030303030303030303030303030303030303635373130",
    "signers": [
      "0x809e853c4e6a542d785cac0bee87bb0296aaa1a4"
    ],
    "powers": [1]
  },
  {
    "name": "kywaillestocks",
    "id": 66277,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0xb1d355c2dfe1dcb0108e7469b99cedb6366d6f98",
    "newMultisig": "0x5b5cc7eda91e5e3b899b9efbc8f5899e0faf9778",
    "salt": "0x3030303030303030303030303030303030303030303030303030303636323737",
    "signers": [
      "0xef22081761b3c2620afc24529f0ccd5f50513169"
    ],
    "powers": [1]
  },
  {
    "name": "youtube",
    "id": 66440,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x79b1179ee0cd6cc7f7217b4a99ebfe8152d2497f",
    "newMultisig": "0x9bff60bfd3e5587964ee0bb6d126099cffd7eae8",
    "salt": "0x3030303030303030303030303030303030303030303030303030303636343430",
    "signers": [
      "0xa5a9335a1c7d65a5544bf1d911ff5c9f84c47f94"
    ],
    "powers": [1]
  },
  {
    "name": "corexsolutions",
    "id": 68148,
    "tier": "batch-nosig",
    "priority": false,
    "oldMultisig": "0x0e37b5a4c1603bb2e4aa076de28ebdbd593c97a6",
    "newMultisig": "0x826e0fdadba1184758c4a1250583d662b7c18ee5",
    "salt": "0x3030303030303030303030303030303030303030303030303030303638313438",
    "signers": [
      "0xfbe7f17440b2c6a523bb056b242682587188ec9d"
    ],
    "powers": [1]
  }
];
