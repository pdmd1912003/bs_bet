/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bs_bet.json`.
 */
export type BsBet = {
  "address": "5NaEYfkNvxQfbvEPV46RzVxuAc8TFR8xPzhWQFnoTcxD",
  "metadata": {
    "name": "bsBet",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createUserProfile",
      "discriminator": [
        9,
        214,
        142,
        184,
        153,
        65,
        50,
        174
      ],
      "accounts": [
        {
          "name": "userProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "userAuthority"
              }
            ]
          }
        },
        {
          "name": "userAuthStateForProfileCreation",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "userAuthority"
              }
            ]
          }
        },
        {
          "name": "activeBet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  101,
                  95,
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "userAuthority"
              }
            ]
          }
        },
        {
          "name": "userAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateActiveBet",
      "discriminator": [
        78,
        151,
        198,
        210,
        208,
        47,
        164,
        86
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                64,
                245,
                133,
                161,
                80,
                246,
                147,
                149,
                78,
                89,
                44,
                174,
                52,
                11,
                101,
                154,
                65,
                156,
                23,
                231,
                18,
                161,
                83,
                32,
                187,
                72,
                159,
                182,
                162,
                241,
                64,
                126
              ]
            }
          }
        },
        {
          "name": "delegationRecordPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "pda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  101,
                  95,
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "5NaEYfkNvxQfbvEPV46RzVxuAc8TFR8xPzhWQFnoTcxD"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateAuthState",
      "discriminator": [
        72,
        94,
        196,
        22,
        81,
        77,
        23,
        128
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                64,
                245,
                133,
                161,
                80,
                246,
                147,
                149,
                78,
                89,
                44,
                174,
                52,
                11,
                101,
                154,
                65,
                156,
                23,
                231,
                18,
                161,
                83,
                32,
                187,
                72,
                159,
                182,
                162,
                241,
                64,
                126
              ]
            }
          }
        },
        {
          "name": "delegationRecordPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "pda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "5NaEYfkNvxQfbvEPV46RzVxuAc8TFR8xPzhWQFnoTcxD"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateUserProfile",
      "discriminator": [
        205,
        1,
        92,
        198,
        12,
        90,
        20,
        133
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                64,
                245,
                133,
                161,
                80,
                246,
                147,
                149,
                78,
                89,
                44,
                174,
                52,
                11,
                101,
                154,
                65,
                156,
                23,
                231,
                18,
                161,
                83,
                32,
                187,
                72,
                159,
                182,
                162,
                241,
                64,
                126
              ]
            }
          }
        },
        {
          "name": "delegationRecordPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataPda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "pda"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "pda",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "5NaEYfkNvxQfbvEPV46RzVxuAc8TFR8xPzhWQFnoTcxD"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "manageDelegation",
      "discriminator": [
        187,
        128,
        14,
        174,
        116,
        37,
        169,
        29
      ],
      "accounts": [
        {
          "name": "userAuthState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "userAuthority"
              }
            ]
          }
        },
        {
          "name": "userAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "ixSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "delegationAction",
          "type": "u8"
        },
        {
          "name": "userSignedMessage",
          "type": "bytes"
        },
        {
          "name": "signature",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ]
    },
    {
      "name": "openBetEphemeral",
      "discriminator": [
        121,
        117,
        109,
        201,
        87,
        8,
        50,
        58
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAuthState",
          "writable": true
        },
        {
          "name": "userProfile",
          "writable": true
        },
        {
          "name": "activeBet",
          "writable": true
        },
        {
          "name": "pythPriceFeed"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "assetNameArg",
          "type": "string"
        },
        {
          "name": "directionArg",
          "type": "u8"
        },
        {
          "name": "amountArg",
          "type": "u64"
        },
        {
          "name": "durationSecondsArg",
          "type": "i64"
        },
        {
          "name": "userAuthorityForPdas",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "openBetNormal",
      "discriminator": [
        242,
        51,
        106,
        166,
        133,
        156,
        173,
        129
      ],
      "accounts": [
        {
          "name": "userSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAuthState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "userSigner"
              }
            ]
          }
        },
        {
          "name": "userProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "userSigner"
              }
            ]
          }
        },
        {
          "name": "activeBet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  101,
                  95,
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "userSigner"
              }
            ]
          }
        },
        {
          "name": "pythPriceFeed"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "assetNameArg",
          "type": "string"
        },
        {
          "name": "directionArg",
          "type": "u8"
        },
        {
          "name": "amountArg",
          "type": "u64"
        },
        {
          "name": "durationSecondsArg",
          "type": "i64"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "resolveBetEphemeral",
      "discriminator": [
        112,
        243,
        240,
        85,
        120,
        241,
        118,
        210
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAuthState",
          "writable": true
        },
        {
          "name": "userProfile",
          "writable": true
        },
        {
          "name": "activeBet",
          "writable": true
        },
        {
          "name": "pythPriceFeed"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "userAuthorityForPdas",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "resolveBetNormal",
      "discriminator": [
        2,
        132,
        35,
        213,
        76,
        167,
        134,
        73
      ],
      "accounts": [
        {
          "name": "userSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAuthState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "userSigner"
              }
            ]
          }
        },
        {
          "name": "userProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "userSigner"
              }
            ]
          }
        },
        {
          "name": "activeBet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  118,
                  101,
                  95,
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "userSigner"
              }
            ]
          }
        },
        {
          "name": "pythPriceFeed"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "undelegateFromMagicblock",
      "discriminator": [
        166,
        88,
        41,
        177,
        208,
        155,
        11,
        226
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "userAuthStateToUndelegate",
          "writable": true
        },
        {
          "name": "userProfileToUndelegate",
          "writable": true
        },
        {
          "name": "activeBetToUndelegate",
          "writable": true
        },
        {
          "name": "magicProgram"
        },
        {
          "name": "magicContext",
          "writable": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "activeBet",
      "discriminator": [
        140,
        87,
        65,
        233,
        198,
        174,
        147,
        90
      ]
    },
    {
      "name": "priceUpdateV2",
      "discriminator": [
        34,
        241,
        35,
        99,
        157,
        126,
        244,
        205
      ]
    },
    {
      "name": "userAuthState",
      "discriminator": [
        243,
        187,
        102,
        170,
        18,
        136,
        71,
        213
      ]
    },
    {
      "name": "userProfile",
      "discriminator": [
        32,
        37,
        119,
        205,
        179,
        180,
        13,
        194
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "timestampOverflow",
      "msg": "Timestamp calculation resulted in an overflow."
    },
    {
      "code": 6001,
      "name": "invalidPythFeedIdFormat",
      "msg": "Invalid Pyth Feed ID hex format."
    },
    {
      "code": 6002,
      "name": "pythPriceFeedError",
      "msg": "Pyth price feed error or price unavailable/too old."
    },
    {
      "code": 6003,
      "name": "pythPriceTooOldOrUnavailable",
      "msg": "Pyth price is too old or currently unavailable."
    },
    {
      "code": 6004,
      "name": "unsupportedAsset",
      "msg": "Asset not supported by this program/feed."
    },
    {
      "code": 6005,
      "name": "negativePythPrice",
      "msg": "Pyth reported a negative price."
    },
    {
      "code": 6006,
      "name": "priceCalculationOverflow",
      "msg": "Price calculation resulted in an overflow during scaling."
    },
    {
      "code": 6007,
      "name": "betNotActiveOrAlreadyResolved",
      "msg": "Bet is not active or has already been resolved/claimed."
    },
    {
      "code": 6008,
      "name": "betNotYetExpired",
      "msg": "Bet has not yet expired and cannot be resolved."
    },
    {
      "code": 6009,
      "name": "insufficientPoints",
      "msg": "User does not have enough points for this bet."
    },
    {
      "code": 6010,
      "name": "userProfileAuthorityMismatch",
      "msg": "The user profile's authority does not match the signer."
    },
    {
      "code": 6011,
      "name": "userProfileBetUserMismatch",
      "msg": "The user profile does not belong to the user who placed the bet."
    },
    {
      "code": 6012,
      "name": "invalidDirection",
      "msg": "Bet direction must be 0 (DOWN) or 1 (UP)."
    },
    {
      "code": 6013,
      "name": "zeroAmount",
      "msg": "Bet amount must be greater than zero."
    },
    {
      "code": 6014,
      "name": "invalidDuration",
      "msg": "Bet duration must be positive."
    },
    {
      "code": 6015,
      "name": "notAuthenticatedOrDelegated",
      "msg": "User is not properly authenticated or state not delegated for this action."
    },
    {
      "code": 6016,
      "name": "alreadyDelegated",
      "msg": "User authentication state is already prepared for MagicBlock delegation or fully delegated."
    },
    {
      "code": 6017,
      "name": "notDelegated",
      "msg": "User authentication state is not currently in a MagicBlock delegated state."
    },
    {
      "code": 6018,
      "name": "delegatedUseQuickBet",
      "msg": "Account is delegated; use quick-bet instructions."
    },
    {
      "code": 6019,
      "name": "invalidDelegationSignature",
      "msg": "Invalid authentication signature or message provided for delegation."
    }
  ],
  "types": [
    {
      "name": "activeBet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "assetName",
            "type": "string"
          },
          {
            "name": "initialPrice",
            "type": "u64"
          },
          {
            "name": "expiryTimestamp",
            "type": "i64"
          },
          {
            "name": "direction",
            "type": "u8"
          },
          {
            "name": "amountStaked",
            "type": "u64"
          },
          {
            "name": "resolvedPrice",
            "type": "u64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "priceFeedMessage",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "docs": [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "publishTime",
            "docs": [
              "The timestamp of this price update in seconds"
            ],
            "type": "i64"
          },
          {
            "name": "prevPublishTime",
            "docs": [
              "The timestamp of the previous price update. This field is intended to allow users to",
              "identify the single unique price update for any moment in time:",
              "for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.",
              "",
              "Note that there may not be such an update while we are migrating to the new message-sending logic,",
              "as some price updates on pythnet may not be sent to other chains (because the message-sending",
              "logic may not have triggered). We can solve this problem by making the message-sending mandatory",
              "(which we can do once publishers have migrated over).",
              "",
              "Additionally, this field may be equal to publish_time if the message is sent on a slot where",
              "where the aggregation was unsuccesful. This problem will go away once all publishers have",
              "migrated over to a recent version of pyth-agent."
            ],
            "type": "i64"
          },
          {
            "name": "emaPrice",
            "type": "i64"
          },
          {
            "name": "emaConf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "priceUpdateV2",
      "docs": [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "writeAuthority",
            "type": "pubkey"
          },
          {
            "name": "verificationLevel",
            "type": {
              "defined": {
                "name": "verificationLevel"
              }
            }
          },
          {
            "name": "priceMessage",
            "type": {
              "defined": {
                "name": "priceFeedMessage"
              }
            }
          },
          {
            "name": "postedSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userAuthState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "userAuthority",
            "type": "pubkey"
          },
          {
            "name": "isDelegated",
            "type": "bool"
          },
          {
            "name": "delegationTimestamp",
            "type": "i64"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "points",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "verificationLevel",
      "docs": [
        "Pyth price updates are bridged to all blockchains via Wormhole.",
        "Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.",
        "The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,",
        "so we also allow for partial verification.",
        "",
        "This enum represents how much a price update has been verified:",
        "- If `Full`, we have verified the signatures for two thirds of the current guardians.",
        "- If `Partial`, only `num_signatures` guardian signatures have been checked.",
        "",
        "# Warning",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "partial",
            "fields": [
              {
                "name": "numSignatures",
                "type": "u8"
              }
            ]
          },
          {
            "name": "full"
          }
        ]
      }
    }
  ]
};
