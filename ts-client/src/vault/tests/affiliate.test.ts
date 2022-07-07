import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { StaticTokenListResolutionStrategy, TokenInfo } from '@solana/spl-token-registry';
import { Wallet, AnchorProvider, BN } from '@project-serum/anchor';

import VaultImpl from '..';
import { airDropSol } from './utils';

const mockWallet = new Wallet(new Keypair());
// devnet ATA creation and reading must use confirmed.
const devnetConnection = new Connection('https://api.devnet.solana.com/', { commitment: 'confirmed' });

const tokenMap = new StaticTokenListResolutionStrategy().resolve();
const SOL_TOKEN_INFO = tokenMap.find((token) => token.symbol === 'SOL') as TokenInfo;
const USDC_TOKEN_INFO = tokenMap.find((token) => token.symbol === 'USDC') as TokenInfo;
const USDT_TOKEN_INFO = tokenMap.find((token) => token.symbol === 'USDT') as TokenInfo;

// TODO: Remove this fake partner ID
const DUMMY_PARTNER_PUBLIC_KEY = new PublicKey('7236FoaWTXJyzbfFPZcrzg3tBpPhGiTgXsGWvjwrYfiF');
describe('Interact with Vault in devnet', () => {
    const provider = new AnchorProvider(devnetConnection, mockWallet, {
        commitment: 'confirmed',
    });

    let vaultImpl: VaultImpl;
    beforeAll(async () => {
        await airDropSol(devnetConnection, mockWallet.publicKey);
        vaultImpl = await VaultImpl.create(
            devnetConnection,
            SOL_TOKEN_INFO,
            {
                cluster: 'devnet',
                affiliateId: DUMMY_PARTNER_PUBLIC_KEY,
            },
        );
    });

    test('Test affiliate init user', async () => {
        try {
            const depositTx = await vaultImpl.depositAffiliate(mockWallet.publicKey, new BN(100_000_000));
            console.log(depositTx.instructions.forEach(ix => console.log(ix.programId.toString())))
            const depositResult = await provider.sendAndConfirm(depositTx);
            console.log('Deposit result', depositResult);
            expect(typeof depositResult).toBe('string');
            
        } catch (error) {
            console.log(error)
        }
    })
});