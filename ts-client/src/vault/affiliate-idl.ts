export type AffiliateVault = {
  version: '0.1.0';
  name: 'affiliate-vault';
  instructions: [
    {
      name: 'initPartner';
      accounts: [
        {
          name: 'partner';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vault';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'partnerToken';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'admin';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'updateFeeRatio';
      accounts: [
        {
          name: 'partner';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'admin';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: 'feeRatio';
          type: 'u64';
        },
      ];
    },
    {
      name: 'initUser';
      accounts: [
        {
          name: 'user';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'partner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'owner';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'deposit';
      accounts: [
        {
          name: 'partner';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'user';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaultProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenVault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaultLpMint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'userToken';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'userLp';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'owner';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'tokenAmount';
          type: 'u64';
        },
        {
          name: 'minimumLpTokenAmount';
          type: 'u64';
        },
      ];
    },
    {
      name: 'withdraw';
      accounts: [
        {
          name: 'partner';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'user';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaultProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenVault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaultLpMint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'userToken';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'userLp';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'owner';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'unmintAmount';
          type: 'u64';
        },
        {
          name: 'minOutAmount';
          type: 'u64';
        },
      ];
    },
    {
      name: 'withdrawDirectlyFromStrategy';
      accounts: [
        {
          name: 'partner';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'user';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaultProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'strategy';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'reserve';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'strategyProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'collateralVault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenVault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaultLpMint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'feeVault';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'userToken';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'userLp';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'owner';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'unmintAmount';
          type: 'u64';
        },
        {
          name: 'minOutAmount';
          type: 'u64';
        },
      ];
    },
    {
      name: 'fundPartner';
      accounts: [
        {
          name: 'partner';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'partnerToken';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'funderToken';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'funder';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        },
      ];
    },
  ];
  accounts: [
    {
      name: 'partner';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'partnerToken';
            type: 'publicKey';
          },
          {
            name: 'vault';
            type: 'publicKey';
          },
          {
            name: 'outstandingFee';
            type: 'u64';
          },
          {
            name: 'feeRatio';
            type: 'u64';
          },
          {
            name: 'cummulativeFee';
            type: 'u128';
          },
        ];
      };
    },
    {
      name: 'user';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'owner';
            type: 'publicKey';
          },
          {
            name: 'partner';
            type: 'publicKey';
          },
          {
            name: 'currentVirtualPrice';
            type: 'u64';
          },
          {
            name: 'lpToken';
            type: 'u64';
          },
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
  ];
  events: [
    {
      name: 'ParnerFee';
      fields: [
        {
          name: 'fee';
          type: 'u64';
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'MathOverflow';
      msg: 'Math operation overflow';
    },
    {
      code: 6001;
      name: 'InvalidOwner';
      msg: 'Invalid owner';
    },
    {
      code: 6002;
      name: 'InvalidFeeRatio';
      msg: 'Invalid ratio';
    },
    {
      code: 6003;
      name: 'WrongFunderToken';
      msg: 'Funder token account must be different from partner token account';
    },
  ];
};

export const IDL: AffiliateVault = {
  version: '0.1.0',
  name: 'affiliate-vault',
  instructions: [
    {
      name: 'initPartner',
      accounts: [
        {
          name: 'partner',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vault',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'partnerToken',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'admin',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'updateFeeRatio',
      accounts: [
        {
          name: 'partner',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'admin',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: 'feeRatio',
          type: 'u64',
        },
      ],
    },
    {
      name: 'initUser',
      accounts: [
        {
          name: 'user',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'partner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'owner',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'deposit',
      accounts: [
        {
          name: 'partner',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'user',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaultProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenVault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaultLpMint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'userToken',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'userLp',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'owner',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'tokenAmount',
          type: 'u64',
        },
        {
          name: 'minimumLpTokenAmount',
          type: 'u64',
        },
      ],
    },
    {
      name: 'withdraw',
      accounts: [
        {
          name: 'partner',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'user',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaultProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenVault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaultLpMint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'userToken',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'userLp',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'owner',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'unmintAmount',
          type: 'u64',
        },
        {
          name: 'minOutAmount',
          type: 'u64',
        },
      ],
    },
    {
      name: 'withdrawDirectlyFromStrategy',
      accounts: [
        {
          name: 'partner',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'user',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaultProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'strategy',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'reserve',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'strategyProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'collateralVault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenVault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaultLpMint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'feeVault',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'userToken',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'userLp',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'owner',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'unmintAmount',
          type: 'u64',
        },
        {
          name: 'minOutAmount',
          type: 'u64',
        },
      ],
    },
    {
      name: 'fundPartner',
      accounts: [
        {
          name: 'partner',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'partnerToken',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'funderToken',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'funder',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'amount',
          type: 'u64',
        },
      ],
    },
  ],
  accounts: [
    {
      name: 'partner',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'partnerToken',
            type: 'publicKey',
          },
          {
            name: 'vault',
            type: 'publicKey',
          },
          {
            name: 'outstandingFee',
            type: 'u64',
          },
          {
            name: 'feeRatio',
            type: 'u64',
          },
          {
            name: 'cummulativeFee',
            type: 'u128',
          },
        ],
      },
    },
    {
      name: 'user',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'owner',
            type: 'publicKey',
          },
          {
            name: 'partner',
            type: 'publicKey',
          },
          {
            name: 'currentVirtualPrice',
            type: 'u64',
          },
          {
            name: 'lpToken',
            type: 'u64',
          },
          {
            name: 'bump',
            type: 'u8',
          },
        ],
      },
    },
  ],
  events: [
    {
      name: 'ParnerFee',
      fields: [
        {
          name: 'fee',
          type: 'u64',
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'MathOverflow',
      msg: 'Math operation overflow',
    },
    {
      code: 6001,
      name: 'InvalidOwner',
      msg: 'Invalid owner',
    },
    {
      code: 6002,
      name: 'InvalidFeeRatio',
      msg: 'Invalid ratio',
    },
    {
      code: 6003,
      name: 'WrongFunderToken',
      msg: 'Funder token account must be different from partner token account',
    },
  ],
};
