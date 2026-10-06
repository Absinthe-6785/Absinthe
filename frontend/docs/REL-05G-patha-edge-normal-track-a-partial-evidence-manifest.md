# REL-05G PATH A partial Track A sanitized evidence manifest

## Scope and verification

Companion: [partial evidence publication](REL-05G-patha-edge-normal-track-a-partial-evidence-publication.md).
Artifact Storage Option 2. Raw JSON/PNG remain outside Git, unchanged.
Local authorized root: operator-supplied `Desktop/evidence/REL05G_TrackA_evidence_recovery_bundle`
(`EVIDENCE_ROOT`); paths below are relative to it, not Git links/public URLs.
An external reviewer needs separately approved access/redaction; hashes alone cannot
prove execution or make evidence reviewable.

Publication base: `9dab5d44e41dbab3d6b7a457fa2b823137891970`.
R0: `edge-a-20261005-7d3f9c6a`; RX: `r-9d6122db-d090-4f64-a35d-6b15f7473164`.
Protocol: `rel05g-patha-human-v1`; export schema:
`rel05g-patha-fixture-export-v1`; event schemaVersion: 1.
B0/B1 exact build/source/manifest/origin tuples are in the companion,
not inferred from filename or a product build.

All 107 actual sizes/recomputed hashes match recovery MANIFEST.csv: PASS,
zero mismatches. 45 JSON + 62 PNG; 95 unique hashes (33 JSON + 62 PNG);
twelve identical-hash pairs. Administrative files below are excluded from 107/95.
IDs are lexicographic inventory labels, not event order/timestamps. No file was
deduplicated away.

## Administrative fingerprints

| External path | Bytes | SHA-256 |
| --- | --- | --- |
| `MANIFEST.csv` | 13828 | `912daf82488d50f2c3c3b949eff57f9a0b76c7c7c4c797e71a8b30cbd49b529a` |
| `README.txt` | 797 | `5d03f0544f7834bd9f0ecc2f295b56358fb8df413cb3551ffd396d9b3aada06e` |

## Complete evidence inventory

| ID | External relative path | Type | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| E001 | `json/edge-a-20261005-7d3f9c6a-087db221-27e0-486f-b8cf-4d055425ec56-events.json` | JSON | 18744 | `525a3147caba32bde96babff00fba9f9a04da8d3afe361135fd0e1b0b2c44498` |
| E002 | `json/edge-a-20261005-7d3f9c6a-0e4c15dd-a6b8-422b-a196-632b05729c73-events.json` | JSON | 16054 | `9639c0e8f22d1e45937d4fdd2dc7a517030bcfc89530c565c1e88cf21aea6c1c` |
| E003 | `json/edge-a-20261005-7d3f9c6a-3675fa60-cabf-4707-8854-004db23a3961-events.json` | JSON | 7310 | `8fc7bf6265b64492f5ec5db9f6ab9281b7ce55eff937923439ce7f90611824fb` |
| E004 | `json/edge-a-20261005-7d3f9c6a-52d4bbc1-daa3-4cf5-934a-4c9a67396881-events (1).json` | JSON | 18816 | `918c6a92b6d8911fd8f84838be3ed71460134ffc73c0aa542b26a912ccb8862e` |
| E005 | `json/edge-a-20261005-7d3f9c6a-52d4bbc1-daa3-4cf5-934a-4c9a67396881-events.json` | JSON | 13044 | `87455480827f295b620c9ed988ed21d22526a9875ff02e6c37338974ab38ea60` |
| E006 | `json/edge-a-20261005-7d3f9c6a-57009c47-3a5e-47a6-8919-df01d4a43139-events.json` | JSON | 7264 | `69aa48f57df0f5751d3238af11135ce4e81c1306d0237c28a429a9cc51fc92c2` |
| E007 | `json/edge-a-20261005-7d3f9c6a-57009c47-3a5e-47a6-8919-df01d4a43139-events(1).json` | JSON | 7264 | `69aa48f57df0f5751d3238af11135ce4e81c1306d0237c28a429a9cc51fc92c2` |
| E008 | `json/edge-a-20261005-7d3f9c6a-5d67a31d-91d3-4780-8324-da59ce2642e1-events.json` | JSON | 11724 | `f76d60cb662c2157bd34a08c12e7520a8a7c10dcd82668728f2eeab5a0f27935` |
| E009 | `json/edge-a-20261005-7d3f9c6a-5f32761b-fa2e-4a59-a7af-426664a48f0e-events.json` | JSON | 7385 | `b63a872df74219f8c3533b6ed9131e0eae25f047d90b5ea57907671afab71424` |
| E010 | `json/edge-a-20261005-7d3f9c6a-5f32761b-fa2e-4a59-a7af-426664a48f0e-events(1).json` | JSON | 7385 | `b63a872df74219f8c3533b6ed9131e0eae25f047d90b5ea57907671afab71424` |
| E011 | `json/edge-a-20261005-7d3f9c6a-641f5799-a647-4186-b61a-d618ecbe0582-events.json` | JSON | 9121 | `4cadeaaeca8092cb05d67b21ce1c9fdf34b71696b3e1dc249001adcabc988533` |
| E012 | `json/edge-a-20261005-7d3f9c6a-6b9ccf5f-d038-49be-bef3-131bdd1ab1b7-events.json` | JSON | 9270 | `4381a5ceca8626b352043dd1253a33c62780960618334887ed5d99a62066e671` |
| E013 | `json/edge-a-20261005-7d3f9c6a-6eb0a1c1-f674-4a91-ba37-53fef1c17bdf-events (1).json` | JSON | 14401 | `0af0847c540cb999186b7a3cd89908bfa7f90f572ebab4a99b3374667d523fae` |
| E014 | `json/edge-a-20261005-7d3f9c6a-6eb0a1c1-f674-4a91-ba37-53fef1c17bdf-events (1)(1).json` | JSON | 14401 | `0af0847c540cb999186b7a3cd89908bfa7f90f572ebab4a99b3374667d523fae` |
| E015 | `json/edge-a-20261005-7d3f9c6a-6eb0a1c1-f674-4a91-ba37-53fef1c17bdf-events.json` | JSON | 9362 | `d64b635326fde2d74b15fc83467ed23e044deec39adc1c9d43b14836d2a0baef` |
| E016 | `json/edge-a-20261005-7d3f9c6a-79e90a8b-fe2a-45eb-9502-538176e06bbb-events (1).json` | JSON | 18188 | `abd7f01e86a246fb101ee91ff801df0770b9ffe9fb1ef91f86de651c8ec730d3` |
| E017 | `json/edge-a-20261005-7d3f9c6a-79e90a8b-fe2a-45eb-9502-538176e06bbb-events (1)(1).json` | JSON | 18188 | `abd7f01e86a246fb101ee91ff801df0770b9ffe9fb1ef91f86de651c8ec730d3` |
| E018 | `json/edge-a-20261005-7d3f9c6a-79e90a8b-fe2a-45eb-9502-538176e06bbb-events.json` | JSON | 9338 | `b92a1d924a1eb23e7712b6b7b41ccf69992280855ea4a0297eea1f8ecdde03a5` |
| E019 | `json/edge-a-20261005-7d3f9c6a-7a66dd0c-6030-4b59-831d-5dd6336dee64-events (1).json` | JSON | 18425 | `c9dc2921eb17e74b90449b66f1b441ca46c886f2fbbba9487133f2eadbc368a1` |
| E020 | `json/edge-a-20261005-7d3f9c6a-7a66dd0c-6030-4b59-831d-5dd6336dee64-events (1)(1).json` | JSON | 18425 | `c9dc2921eb17e74b90449b66f1b441ca46c886f2fbbba9487133f2eadbc368a1` |
| E021 | `json/edge-a-20261005-7d3f9c6a-7a66dd0c-6030-4b59-831d-5dd6336dee64-events.json` | JSON | 13265 | `ee39edcdab8ebed1f8287577bf6c58aa8f1c4b46a1bece2ab0b4d171ac48aca3` |
| E022 | `json/edge-a-20261005-7d3f9c6a-7a66dd0c-6030-4b59-831d-5dd6336dee64-events(1).json` | JSON | 13265 | `ee39edcdab8ebed1f8287577bf6c58aa8f1c4b46a1bece2ab0b4d171ac48aca3` |
| E023 | `json/edge-a-20261005-7d3f9c6a-7c1705f0-f8af-4729-957c-952738fa8ee7-events.json` | JSON | 8875 | `19e894d486e83469c18e1de9fd7f6a60c3fbe848f9abc1f9a8ac72df66763e20` |
| E024 | `json/edge-a-20261005-7d3f9c6a-8020bd97-2090-4362-be93-527c55111fa4-events.json` | JSON | 7353 | `9926be7f71ff208270c884f0779cdc0ea9da11c694b1e550e2566d79efbfdbce` |
| E025 | `json/edge-a-20261005-7d3f9c6a-9b780a54-5bf9-4617-b74e-e44375fd1ede-events.json` | JSON | 16135 | `de54cc1bf8db919bfa32c3cd7e03e0a2afcbf11490558c906ca88c0f04c2416e` |
| E026 | `json/edge-a-20261005-7d3f9c6a-af0834d3-72ff-481d-91f4-3035da8b4a4e-events.json` | JSON | 9153 | `1520d879f6de11cadaf93f1f83d41585824366aff9c7c5354dd1464cd6d2e445` |
| E027 | `json/edge-a-20261005-7d3f9c6a-af0834d3-72ff-481d-91f4-3035da8b4a4e-events(1).json` | JSON | 9153 | `1520d879f6de11cadaf93f1f83d41585824366aff9c7c5354dd1464cd6d2e445` |
| E028 | `json/edge-a-20261005-7d3f9c6a-c1bab489-70d2-48a5-ac52-c6f5eae724c5-events.json` | JSON | 13326 | `5cf6e2c89b208636bae3d49da2f79b2ce1343d6001ffebb3ec536c16ff176c12` |
| E029 | `json/edge-a-20261005-7d3f9c6a-c1bab489-70d2-48a5-ac52-c6f5eae724c5-events(1).json` | JSON | 13326 | `5cf6e2c89b208636bae3d49da2f79b2ce1343d6001ffebb3ec536c16ff176c12` |
| E030 | `json/edge-a-20261005-7d3f9c6a-c8d1c963-2902-4292-a7b3-926017ce015e-events (1).json` | JSON | 19910 | `eed069e503a5dabcafc7a2a06537f782eedcd96950844401e7e8fadba116816b` |
| E031 | `json/edge-a-20261005-7d3f9c6a-c8d1c963-2902-4292-a7b3-926017ce015e-events (1)(1).json` | JSON | 19910 | `eed069e503a5dabcafc7a2a06537f782eedcd96950844401e7e8fadba116816b` |
| E032 | `json/edge-a-20261005-7d3f9c6a-c8d1c963-2902-4292-a7b3-926017ce015e-events.json` | JSON | 12774 | `cfd9b1ce48c5f6b84d8cf02eea120d95c2ff77a73f5fd040d1ed327f9e85105c` |
| E033 | `json/edge-a-20261005-7d3f9c6a-c8d1c963-2902-4292-a7b3-926017ce015e-events(1).json` | JSON | 12774 | `cfd9b1ce48c5f6b84d8cf02eea120d95c2ff77a73f5fd040d1ed327f9e85105c` |
| E034 | `json/edge-a-20261005-7d3f9c6a-d0861477-dd9e-4b85-9e8c-93be6f57e957-events.json` | JSON | 16064 | `aeb5218b9df35672135d2b157e2e5739d0de2bf51402a0f75558034d3e12d632` |
| E035 | `json/edge-a-20261005-7d3f9c6a-d31ef8d7-0c99-4676-9584-c2b4a98bf8bf-events.json` | JSON | 9037 | `e06ea4eb3f24f20f04017228a8218bd1a2b771be5f7421f7b44c57b5156f0969` |
| E036 | `json/edge-a-20261005-7d3f9c6a-d31ef8d7-0c99-4676-9584-c2b4a98bf8bf-events(1).json` | JSON | 9037 | `e06ea4eb3f24f20f04017228a8218bd1a2b771be5f7421f7b44c57b5156f0969` |
| E037 | `json/edge-a-20261005-7d3f9c6a-d88a8aae-0e3f-42b0-a11b-213d1fbe231b-events.json` | JSON | 9936 | `7418bcb5aaec7e58897748a3e804058f9f2ef6e434f6ebfcfd8f40457303650b` |
| E038 | `json/edge-a-20261005-7d3f9c6a-dd0f6fd0-6571-4470-91a3-6bc54ae36f0c-events (1).json` | JSON | 18760 | `ef35e45bfb17e7bdfb5dc8576bf312d00537562cb9808cf9a59ff12401a63062` |
| E039 | `json/edge-a-20261005-7d3f9c6a-dd0f6fd0-6571-4470-91a3-6bc54ae36f0c-events.json` | JSON | 12355 | `d1cfeb98ce7c1a078aecdca994c1229f18fed9edf2f5f2cf818f8b138ce446f6` |
| E040 | `json/edge-a-20261005-7d3f9c6a-de2f5fbc-a7c1-4815-a6ba-effb21153a79-events.json` | JSON | 11411 | `ec3b0c039b092ac0ba0b7a231974d1f18e16661a91e04fd3f37a9b31f2570dfa` |
| E041 | `json/edge-a-20261005-7d3f9c6a-e0776931-78d8-48f0-b18f-588a8062b00e-events.json` | JSON | 13857 | `d10f027123fc5640dff8dca0b7be5e55af69f538117d525e55981d274ef211ed` |
| E042 | `json/edge-a-20261005-7d3f9c6a-e0776931-78d8-48f0-b18f-588a8062b00e-events(1).json` | JSON | 13857 | `d10f027123fc5640dff8dca0b7be5e55af69f538117d525e55981d274ef211ed` |
| E043 | `json/edge-a-20261005-7d3f9c6a-fd0fd8b6-1569-4071-99ca-9d4c6f68a506-events.json` | JSON | 8462 | `e56111d8afcb9094c38fb182f6e56fcf97bd843a7a56ba0ac7f59a08591f1d65` |
| E044 | `json/edge-a-20261005-7d3f9c6a-fe892cc1-c657-4db0-ab2e-33193fab876b-events.json` | JSON | 9236 | `1d254deecfbc5448b1462958d50f70412383d3b6dbfb217391a3f18443ec38d1` |
| E045 | `json/r-9d6122db-d090-4f64-a35d-6b15f7473164-81ad99ad-eb33-4c42-9eda-bb0ea1e699da-events.json` | JSON | 6605 | `92334db61820a7dcbaac2e558fa26d506a4875993d5cff69bf1dc6b9cd4cc923` |
| E046 | `screenshots/crop_a1.png` | PNG | 41477 | `445fd17f1e4bc1c84b86412510d76bd59e00431b77666654736f65fbbec2fbe0` |
| E047 | `screenshots/image(20261005-132130).png` | PNG | 559090 | `1119b7580be89c161ab17e3faa11273e3fecb6ebd16ee0f585dba69b057cee7d` |
| E048 | `screenshots/image(20261005-132327).png` | PNG | 559950 | `fd2c25ec46901a159c7767ca67eac201b150031fa56fcbfc1e1e1088688c2388` |
| E049 | `screenshots/image(20261005-132527).png` | PNG | 561910 | `62bd49c60e3f11e58158b45ea9da2169237a3977111002c4bfa889be6417e490` |
| E050 | `screenshots/image(20261005-132737).png` | PNG | 562141 | `a259f4a703d5659a8bc5ad4826dbb44f1c729695525282ebc2cf53f514db37f0` |
| E051 | `screenshots/image(20261005-133111).png` | PNG | 560749 | `a10582b94207736ee2cdfaec0d0efeaacc3b09f4b07b40eb8249c4d7d2cdce38` |
| E052 | `screenshots/image(20261005-133816).png` | PNG | 568279 | `b3fa7e03ca7db556dd5e7e1412bb971e2430fc4f251298140295deef59db73d9` |
| E053 | `screenshots/image(20261005-134046).png` | PNG | 77649 | `4b8e42a6ad9e3156d8af46294f303b960668326d0e0c7f8cede183e605ce16b7` |
| E054 | `screenshots/image(20261006-023431).png` | PNG | 565812 | `e7bac90a095164d3f7a44e88bafc3208ec398d9b55b64f8259d1d5380d7805b0` |
| E055 | `screenshots/image(20261006-023639).png` | PNG | 609228 | `9be4cbcbc0ae192deb3ef154d622cc61dc3bb22877bfc215cca00473afeed3c0` |
| E056 | `screenshots/image(20261006-023815).png` | PNG | 610469 | `0bc5805bb8321dd022fe077d7a78b7a7866acbc82dd61dab2d7fc3ba788b7052` |
| E057 | `screenshots/image(20261006-023953).png` | PNG | 611265 | `a53d13c4dda7db848b3631fbc2d3d57c27e86f82e24ab4ae5439567a8be58193` |
| E058 | `screenshots/image(20261006-024136).png` | PNG | 632215 | `e7c3ecb24ef7699c395668bb0f38adfe7d8d9bf128bbfb5ec05dea7018fdf3a6` |
| E059 | `screenshots/image(20261006-024252).png` | PNG | 632220 | `4ae1918ab3fbed1386a1d9cf0fb17bf4b2f150b8fa4b1283205d959e670bfa1f` |
| E060 | `screenshots/image(20261006-024349).png` | PNG | 631514 | `042592b05d457607bf6db74d0b343a7296eda8ba2b84eeaa6197ea6fe0f501f9` |
| E061 | `screenshots/image(20261006-024554).png` | PNG | 639972 | `fe1a4771bb7cf9c0d44111e26fd789d0d78688ac641201104905e679fc7089f6` |
| E062 | `screenshots/image(20261006-024925).png` | PNG | 628070 | `9306648e70a4e5133f48dc269abaead5a96e288f6611a0fcba1146b96d1420f5` |
| E063 | `screenshots/image(20261006-025003).png` | PNG | 628814 | `90b352915570f77758298e4253973c4be47daef879bb678046cc332169e6274a` |
| E064 | `screenshots/image(20261006-025309).png` | PNG | 595019 | `9e9f2969d75de22a5ddf4a7e570d76de629c29128d2a296afdaa86f5e7fb698b` |
| E065 | `screenshots/image(20261006-025655).png` | PNG | 568410 | `ab659a0793e39559aad619ce3f12110402ddc5c5d78be4b880a52238a92f4e3b` |
| E066 | `screenshots/image(20261006-025756).png` | PNG | 587548 | `42bf99ddaa2685b3618445bd3cccd105a289d32b5e2ca4648c43562210bdd932` |
| E067 | `screenshots/image(20261006-030051).png` | PNG | 552725 | `445a7b0eba86739a8b13f619de9b6a6bfffea9a9edd03cc6905439f0326e4fb7` |
| E068 | `screenshots/image(20261006-030419).png` | PNG | 366406 | `271cce0906f0651a01415148059f7f37ace86e82b0cfc88616c00fa0525d21a1` |
| E069 | `screenshots/image(20261006-030425).png` | PNG | 336491 | `89a51710fd5da51c0d62daa96bad7aa02a2a90a88121b784c3e1d7fb0956f30f` |
| E070 | `screenshots/image(20261006-030932).png` | PNG | 568456 | `d2f7bee200e73668d24ac025e434456f4ce09bd5889580a51b46730c24344d2b` |
| E071 | `screenshots/image(20261006-031001).png` | PNG | 588522 | `ecb5eea17621995c5e35351c873040b67d8cd86e219ccebc0fadba97c5259f41` |
| E072 | `screenshots/image(20261006-031024).png` | PNG | 588475 | `66cfcd716bcdf34f53f4451fcf7f2d5fe32df13c208bad4d7e3841e111ad638f` |
| E073 | `screenshots/image(20261006-031103).png` | PNG | 579613 | `de2a42e38840f08eaade612c93588f4aa866aa11aa0aaad8e4e510c47837b28e` |
| E074 | `screenshots/image(20261006-031126).png` | PNG | 579225 | `51abb0d7a05f194da603d2f8d2148b7b8b7d36f72c4a5a50f8f0722908c534d2` |
| E075 | `screenshots/image(20261006-031140).png` | PNG | 586525 | `fdb9310cb565a6fe97a930a4e69d6d3cd3a1eb64dd3a60ff6dd704d5610fb4e2` |
| E076 | `screenshots/image(20261006-031221).png` | PNG | 579671 | `b17807dbae9c4c6fe46d58171e801ba1e5fc2093cea69180e5cefbf2dad0eb16` |
| E077 | `screenshots/image(20261006-031240).png` | PNG | 579658 | `811a37540bc0756c0e8d7b6675df3fe6b9d04c7210f1f23f52dcd33b7dffd56c` |
| E078 | `screenshots/image(20261006-031255).png` | PNG | 579470 | `beaa583fab879685dfe1acb1e0d6e78a430a9a4f1c2435db9d82eb16b7791838` |
| E079 | `screenshots/image(20261006-031559).png` | PNG | 566179 | `7612d9e8075ee3dc2fca22b1d71b2b8e4c9b41e9e3e7445564060acefa32bb91` |
| E080 | `screenshots/image(20261006-031628).png` | PNG | 569351 | `6d772719f69d755c5d2b8c3a3add06fe60a38be8da4faaa156dddc016e6fdeb0` |
| E081 | `screenshots/image(20261006-031730).png` | PNG | 114436 | `14b46550f010d2be7ece8e99f3a04326007f87fcd17385716b8d37b15f9d5fe2` |
| E082 | `screenshots/image(20261006-031752).png` | PNG | 114341 | `5780e82b3f74beba64395005e286365aed69fb4341cfaa094b903a6caf44269f` |
| E083 | `screenshots/image(20261006-031818).png` | PNG | 569669 | `28a9d3ced95351510f889d93e6a8904afeba5903a411806e758ad014c221e063` |
| E084 | `screenshots/image(20261006-032037).png` | PNG | 331198 | `c144aae86e9b45fb6e7a388f0fce24a77cffeda39ee3a1452de18d36f9fe9ca8` |
| E085 | `screenshots/image(20261006-032045).png` | PNG | 330886 | `acf6147046df5bbc6121f76802f56a6fea38e72cc72c061a47bcd9af60c4a359` |
| E086 | `screenshots/image(20261006-032115).png` | PNG | 336594 | `332fe3ad326ff0c47493f3b4b7c98c13c317ea395e12a5d08e7361ac28f52a32` |
| E087 | `screenshots/image(20261006-032131).png` | PNG | 333313 | `ce491435c6cd96d638ab519075b4aacfbd2da42f410678db832f769eff75e332` |
| E088 | `screenshots/image(20261006-032210).png` | PNG | 331672 | `c4b6d7f8d6c6ea004d103adc560b63dc5a87ec06138f896d1574c73a155c2b68` |
| E089 | `screenshots/image(20261006-032553).png` | PNG | 565759 | `506249906a09b35c60273a4fd0a680511d688527b0e21969858ce9451e075595` |
| E090 | `screenshots/image(20261006-032621).png` | PNG | 584295 | `5d0ba4dee74f644ce9c49113ec561e1cf0bf313570d9d1f266c9351e85447658` |
| E091 | `screenshots/image(20261006-032718).png` | PNG | 115886 | `69e61d8831f1963937ba25b3bb62a4d6fa44d87c6d9654dfac627f98f31efe31` |
| E092 | `screenshots/image(20261006-033351).png` | PNG | 367910 | `9d56967f27f8bd7f055be089e417ee30f483a4922ebc8ece5498e2f15a0971e9` |
| E093 | `screenshots/image(20261006-033506).png` | PNG | 14808 | `b61a310cf35179ceea25580666d809ed13b9ebafb293a501affc348f6be42db0` |
| E094 | `screenshots/image(20261006-033556).png` | PNG | 338320 | `cbe326ac3a3f9347221d685fb623e18c50346b6865e2a6e9ac9d4faf8c6329a9` |
| E095 | `screenshots/image(20261006-033935).png` | PNG | 366979 | `a13aa9babfd12f25e7092d4f1865b734fc8768bda63585a817e855866be24a84` |
| E096 | `screenshots/image(20261006-034029).png` | PNG | 353453 | `1061bfc4a165a31a1cd4d4e2fa25fcb48d179a8e0075837b8f2158b9ca9c5475` |
| E097 | `screenshots/image(20261006-034126).png` | PNG | 367979 | `863b423e82cfa5fe81cc0808741eae66e8a3bbc91cc74c33421db67cb6052580` |
| E098 | `screenshots/image(20261006-034708).png` | PNG | 347899 | `f7c681ec43ffb02db118f7e28a9f97c53621b12580477f255c82428e0687cc78` |
| E099 | `screenshots/image(20261006-034822).png` | PNG | 334835 | `ca74efc8f5a71df866e8da4d531ed9b4ceae80eed6f3f12fb51719dfff226e9a` |
| E100 | `screenshots/image(20261006-035234).png` | PNG | 383280 | `74934f7fb0ee3950102b8171a035fe88206816bff8f77c6eb1fe5aaa5a11b9e2` |
| E101 | `screenshots/image(20261006-035656).png` | PNG | 145640 | `6863953b9d8cdc0b99165c4630aeccbc6ec583b4948187626be9ce7e9f6743a8` |
| E102 | `screenshots/image(20261006-040047).png` | PNG | 364106 | `263edd090aea429e4f7530ee54a1c03fab2c4ade6fb304c257fea7a0ce8fc015` |
| E103 | `screenshots/image(20261006-041521).png` | PNG | 563651 | `d89df5a0df0fbeb6e2106c38ac0d4eb0071e9b48c03979cb00376c16c31b77d2` |
| E104 | `screenshots/image(20261006-041547).png` | PNG | 598951 | `919849c7bc1faf02032f3d36fb2f43b19ac9dfdccd18aebaa0cf399b25a43ff9` |
| E105 | `screenshots/image(20261006-041638).png` | PNG | 114594 | `997f5ba0b48449fc2e2d6044999926d956e4e8585e68e237cddbb0de4410efe0` |
| E106 | `screenshots/image(20261006-041718).png` | PNG | 599071 | `5adbf8aa16a21493260f2719f033ea57884d23a7ab6bbadb83eae4e2f7d3e9e5` |
| E107 | `screenshots/image(20261006-041819).png` | PNG | 616175 | `227eb804e5ee0b15f82170705f9e511526224d960ce6c25d8fa4e737e3dfc5fe` |

## Exact duplicate groups

These are retained additional copies, not independent trials. Earlier/expanded
exports with different hashes are not duplicates merely because their suffixes look similar.

| Members | SHA-256 |
| --- | --- |
| E006, E007 | `69aa48f57df0f5751d3238af11135ce4e81c1306d0237c28a429a9cc51fc92c2` |
| E009, E010 | `b63a872df74219f8c3533b6ed9131e0eae25f047d90b5ea57907671afab71424` |
| E013, E014 | `0af0847c540cb999186b7a3cd89908bfa7f90f572ebab4a99b3374667d523fae` |
| E016, E017 | `abd7f01e86a246fb101ee91ff801df0770b9ffe9fb1ef91f86de651c8ec730d3` |
| E019, E020 | `c9dc2921eb17e74b90449b66f1b441ca46c886f2fbbba9487133f2eadbc368a1` |
| E021, E022 | `ee39edcdab8ebed1f8287577bf6c58aa8f1c4b46a1bece2ab0b4d171ac48aca3` |
| E026, E027 | `1520d879f6de11cadaf93f1f83d41585824366aff9c7c5354dd1464cd6d2e445` |
| E028, E029 | `5cf6e2c89b208636bae3d49da2f79b2ce1343d6001ffebb3ec536c16ff176c12` |
| E030, E031 | `eed069e503a5dabcafc7a2a06537f782eedcd96950844401e7e8fadba116816b` |
| E032, E033 | `cfd9b1ce48c5f6b84d8cf02eea120d95c2ff77a73f5fd040d1ed327f9e85105c` |
| E035, E036 | `e06ea4eb3f24f20f04017228a8218bd1a2b771be5f7421f7b44c57b5156f0969` |
| E041, E042 | `d10f027123fc5640dff8dca0b7be5e55af69f538117d525e55981d274ef211ed` |

## JSON content-derived provenance

Fixture identity is not an OS PID or attested human/browser identity.
Sequence is within one document only. All JSON has qualificationOnly=true;
physicalResult/restoreClass UI defaults are not final verdicts. Being in R0 is not PASS.

| ID | Row | Run | Build | Role | Full document instanceId | Events / first-last sequence | Fresh writes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E001 | A3 | R0 | B1 | CURRENT_FIXTURE | `087db221-27e0-486f-b8cf-4d055425ec56` | 27 / 1-27 | 1 |
| E002 | A4 | R0 | B1 | CURRENT_FIXTURE | `0e4c15dd-a6b8-422b-a196-632b05729c73` | 22 / 1-22 | 1 |
| E003 | A3 | R0 | B1 | CURRENT_FIXTURE | `3675fa60-cabf-4707-8854-004db23a3961` | 9 / 1-9 | 0 |
| E004 | A2 | R0 | B1 | CURRENT_FIXTURE | `52d4bbc1-daa3-4cf5-934a-4c9a67396881` | 27 / 1-27 | 0 |
| E005 | A2 | R0 | B1 | CURRENT_FIXTURE | `52d4bbc1-daa3-4cf5-934a-4c9a67396881` | 18 / 1-18 | 0 |
| E006 | A10 | R0 | B1 | CURRENT_FIXTURE | `57009c47-3a5e-47a6-8919-df01d4a43139` | 8 / 1-8 | 0 |
| E007 | A10 | R0 | B1 | CURRENT_FIXTURE | `57009c47-3a5e-47a6-8919-df01d4a43139` | 8 / 1-8 | 0 |
| E008 | A1 | R0 | B0 | OLD_FIXTURE | `5d67a31d-91d3-4780-8324-da59ce2642e1` | 16 / 1-16 | 1 |
| E009 | A11 | R0 | B1 | CURRENT_FIXTURE | `5f32761b-fa2e-4a59-a7af-426664a48f0e` | 8 / 1-8 | 0 |
| E010 | A11 | R0 | B1 | CURRENT_FIXTURE | `5f32761b-fa2e-4a59-a7af-426664a48f0e` | 8 / 1-8 | 0 |
| E011 | A1 | R0 | B0 | OLD_FIXTURE | `641f5799-a647-4186-b61a-d618ecbe0582` | 12 / 1-12 | 1 |
| E012 | A11 | R0 | B1 | CURRENT_FIXTURE | `6b9ccf5f-d038-49be-bef3-131bdd1ab1b7` | 11 / 1-11 | 1 |
| E013 | A13 | R0 | B1 | OLD_FIXTURE | `6eb0a1c1-f674-4a91-ba37-53fef1c17bdf` | 19 / 1-19 | 1 |
| E014 | A13 | R0 | B1 | OLD_FIXTURE | `6eb0a1c1-f674-4a91-ba37-53fef1c17bdf` | 19 / 1-19 | 1 |
| E015 | A13 | R0 | B1 | OLD_FIXTURE | `6eb0a1c1-f674-4a91-ba37-53fef1c17bdf` | 11 / 1-11 | 1 |
| E016 | A12 | R0 | B1 | OLD_FIXTURE | `79e90a8b-fe2a-45eb-9502-538176e06bbb` | 25 / 1-25 | 1 |
| E017 | A12 | R0 | B1 | OLD_FIXTURE | `79e90a8b-fe2a-45eb-9502-538176e06bbb` | 25 / 1-25 | 1 |
| E018 | A12 | R0 | B1 | OLD_FIXTURE | `79e90a8b-fe2a-45eb-9502-538176e06bbb` | 11 / 1-11 | 1 |
| E019 | A14 | R0 | B1 | OLD_FIXTURE | `7a66dd0c-6030-4b59-831d-5dd6336dee64` | 25 / 1-25 | 3 |
| E020 | A14 | R0 | B1 | OLD_FIXTURE | `7a66dd0c-6030-4b59-831d-5dd6336dee64` | 25 / 1-25 | 3 |
| E021 | A14 | R0 | B1 | OLD_FIXTURE | `7a66dd0c-6030-4b59-831d-5dd6336dee64` | 17 / 1-17 | 2 |
| E022 | A14 | R0 | B1 | OLD_FIXTURE | `7a66dd0c-6030-4b59-831d-5dd6336dee64` | 17 / 1-17 | 2 |
| E023 | A5 | R0 | B1 | CURRENT_FIXTURE | `7c1705f0-f8af-4729-957c-952738fa8ee7` | 11 / 1-11 | 0 |
| E024 | A2 | R0 | B0 | CURRENT_FIXTURE | `8020bd97-2090-4362-be93-527c55111fa4` | 9 / 1-9 | 0 |
| E025 | A3 | R0 | B1 | CURRENT_FIXTURE | `9b780a54-5bf9-4617-b74e-e44375fd1ede` | 23 / 1-23 | 0 |
| E026 | A8 | R0 | B1 | CURRENT_FIXTURE | `af0834d3-72ff-481d-91f4-3035da8b4a4e` | 11 / 1-11 | 1 |
| E027 | A8 | R0 | B1 | CURRENT_FIXTURE | `af0834d3-72ff-481d-91f4-3035da8b4a4e` | 11 / 1-11 | 1 |
| E028 | A6 | R0 | B1 | CURRENT_FIXTURE | `c1bab489-70d2-48a5-ac52-c6f5eae724c5` | 18 / 1-18 | 0 |
| E029 | A6 | R0 | B1 | CURRENT_FIXTURE | `c1bab489-70d2-48a5-ac52-c6f5eae724c5` | 18 / 1-18 | 0 |
| E030 | A14 | R0 | B1 | CURRENT_FIXTURE | `c8d1c963-2902-4292-a7b3-926017ce015e` | 27 / 1-27 | 0 |
| E031 | A14 | R0 | B1 | CURRENT_FIXTURE | `c8d1c963-2902-4292-a7b3-926017ce015e` | 27 / 1-27 | 0 |
| E032 | A14 | R0 | B1 | CURRENT_FIXTURE | `c8d1c963-2902-4292-a7b3-926017ce015e` | 16 / 1-16 | 0 |
| E033 | A14 | R0 | B1 | CURRENT_FIXTURE | `c8d1c963-2902-4292-a7b3-926017ce015e` | 16 / 1-16 | 0 |
| E034 | A4 | R0 | B1 | CURRENT_FIXTURE | `d0861477-dd9e-4b85-9e8c-93be6f57e957` | 22 / 1-22 | 1 |
| E035 | A7 | R0 | B1 | CURRENT_FIXTURE | `d31ef8d7-0c99-4676-9584-c2b4a98bf8bf` | 11 / 1-11 | 1 |
| E036 | A7 | R0 | B1 | CURRENT_FIXTURE | `d31ef8d7-0c99-4676-9584-c2b4a98bf8bf` | 11 / 1-11 | 1 |
| E037 | A3 | R0 | B1 | CURRENT_FIXTURE | `d88a8aae-0e3f-42b0-a11b-213d1fbe231b` | 13 / 1-13 | 1 |
| E038 | A2 | R0 | B1 | CURRENT_FIXTURE | `dd0f6fd0-6571-4470-91a3-6bc54ae36f0c` | 27 / 1-27 | 0 |
| E039 | A2 | R0 | B1 | CURRENT_FIXTURE | `dd0f6fd0-6571-4470-91a3-6bc54ae36f0c` | 17 / 1-17 | 0 |
| E040 | A5 | R0 | B1 | CURRENT_FIXTURE | `de2f5fbc-a7c1-4815-a6ba-effb21153a79` | 15 / 1-15 | 1 |
| E041 | A6 | R0 | B1 | CURRENT_FIXTURE | `e0776931-78d8-48f0-b18f-588a8062b00e` | 19 / 1-19 | 1 |
| E042 | A6 | R0 | B1 | CURRENT_FIXTURE | `e0776931-78d8-48f0-b18f-588a8062b00e` | 19 / 1-19 | 1 |
| E043 | A7 | R0 | B1 | CURRENT_FIXTURE | `fd0fd8b6-1569-4071-99ca-9d4c6f68a506` | 10 / 1-10 | 0 |
| E044 | A11 | R0 | B1 | CURRENT_FIXTURE | `fe892cc1-c657-4db0-ab2e-33193fab876b` | 11 / 1-11 | 1 |
| E045 | A11 | RX | B1 | CURRENT_FIXTURE | `81ad99ad-eb33-4c42-9eda-bb0ea1e699da` | 8 / 1-8 | 0 |

## Screenshot content mapping and limits

Ranges expand inclusively to all listed IDs; every PNG is covered.
Mapping uses visible fixture/action/instance/run fields where available.
Crops lacking these have UNKNOWN independent linkage. Neither filename ordering
nor an unseen UI action is certified. Raw private browser chrome is not republished.

| IDs | Visible content / mapping limit |
| --- | --- |
| E046 | A1 crop; derivative/original/crop provenance UNKNOWN; partial panel |
| E047-E050 | A1 B0 OLD side-by-side windows, first/reverse token actions; no fresh repeat |
| E051 | A2 wrong-role OLD setup; no successful L control |
| E052-E053 | A2 B0 CURRENT setup/request UI_ACTION_FAILED |
| E054-E061 | A2 B1 early lock panels; timer-ended in raw traces |
| E062-E063 | A2 B1 later manual-holder-release direction; HELD/REQUESTED then requester HELD |
| E064-E067 | A3 B1 initial two-window controls; no raw visibility events |
| E068-E069 | A3 B1 fresh two-tab pair; opposite selected tabs/matching token |
| E070-E072 | A4 B1 separate windows, one storage write each direction |
| E073-E078 | A4 B1 alternating L HELD/REQUESTED and manual-release acquisition |
| E079-E080 | A5 B1 two-window setup/seed |
| E081-E082 | A5 B1 peer-only viewport; target minimize not proven |
| E083 | A5 B1 both returned panels/retained bytes |
| E084-E088 | A6 B1 two tabs before/after, peer read; close action not captured |
| E089-E090 | A7 B1 two-window setup/seed |
| E091 | A7 B1 peer-only crop/read; target close unproven |
| E092 | A8 B1 pre-close panel/export marker, not disappearance |
| E093 | A9 Task Manager crop; six Edge entries; run/time/filter/access UNKNOWN |
| E094 | A10 B1 fresh CURRENT reads A8 token; launch action unrecorded |
| E095 | A11 B1 earlier canonical seed/marker |
| E096-E097 | A11 B1 off-run setup/null, not canonical run |
| E098 | A12 B1 OLD pre-state |
| E099 | A12 context B1 NEUTRAL, different default run/not started |
| E100 | A13 B1 OLD pre-export/seed, not A12 return |
| E101 | A13 exact B1 OLD path ERR_INTERNET_DISCONNECTED; safe control UNKNOWN |
| E102 | A13 B1 retained original OLD bytes, not offline new execution |
| E103-E104 | A14 B1 OLD/CURRENT setup/one-way token read |
| E105 | A14 B1 CURRENT HELD initial token; OLD outside crop |
| E106 | A14 B1 matching fresh OLD token/CURRENT HELD |
| E107 | A14 B1 visible-control second fresh OLD token/CURRENT HELD |

## Recovery, privacy and missing provenance

Recovery README describes conversation-recovered files, not an execution journal
or verified capture chronology. Filename suffix/mtime is not original event order.
All PNGs were visually inspected without altering bytes. No new redaction/export
was created. Existing crop_a1.png has UNKNOWN original linkage, region recipe,
creator and purpose; it is not an attested privacy-safe public derivative.
Other images include unrelated browser chrome and stay private. Future reviewer
delivery needing redaction requires original/derivative hash/region/reason records
and separate authorization. No automatic upload or permanent retention/deletion
policy is implied.

No recording/journal/version UI or complete process/window inventory was recovered.
Missing required control evidence remains INCONCLUSIVE, not repaired here.
A9/A13 captures, A11 RX, B0 A2 failure, initial incomplete A3, all retries and
duplicate/expanded exports remain accessible by ID. This is review preparation,
not independent approval, lifecycle qualification, P1-P7 satisfaction or activation.
