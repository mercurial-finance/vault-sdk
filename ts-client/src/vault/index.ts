import { AnchorProvider, Program } from '@project-serum/anchor';
import { StaticTokenListResolutionStrategy } from '@solana/spl-token-registry';
import { Connection, PublicKey } from '@solana/web3.js';
import got from 'got';
import { IDL, Vault as VaultIdl } from "./idl";

import { KEEPER_URL, PROGRAM_ID } from './constants';
import { VaultInfo } from './types';
import { VaultImpl } from './vaultImpl';

const tokenResolver = new StaticTokenListResolutionStrategy()
    .resolve();

type AllVaults = { data: VaultInfo, vault: VaultImpl }[];
export default class Vaults {
    private static URL = KEEPER_URL["mainnet-beta"];

    private connection: Connection;
    private allVaults: AllVaults = [];
    private constructor(connection: Connection, allVaults: AllVaults) {
        this.connection = connection;
        this.allVaults = allVaults;
    };

    private static async fetchAllVaultInfo(connection: Connection) {
        const provider = new AnchorProvider(connection, {} as any, AnchorProvider.defaultOptions());
        const program = new Program<VaultIdl>(IDL as VaultIdl, PROGRAM_ID, provider);

        const allVaultsInfo = await (got(`${this.URL}/vault_info`).json<VaultInfo[]>());
        const allVaultsPromises = allVaultsInfo.map(async (vault) => {
            const tokenInfo = tokenResolver.find(token => token.address === vault.token_address);

            if (tokenInfo) {
                return {
                    data: vault,
                    vault: await VaultImpl.create(
                        program,
                        { baseTokenMint: new PublicKey(tokenInfo.address), baseTokenDecimals: tokenInfo.decimals }
                    )
                };
            } else {
                console.log({ error: `TokenInfo for ${vault.token_address} not found!` })
                return null;
            };
        })
        return allVaultsPromises;
    }

    public static async create(connection: Connection) {
        const allVaultsPromises = await this.fetchAllVaultInfo(connection);
        const allVaults = (await Promise.all(allVaultsPromises)).filter(Boolean) as AllVaults;
        return new Vaults(connection, allVaults);
    }

    // Refetch all vault_info data, and merge them.
    async refetch() {
        const allVaultsPromises = await Vaults.fetchAllVaultInfo(this.connection);
        const allVaults = (await Promise.all(allVaultsPromises)).filter(Boolean) as AllVaults;

        allVaults.forEach(vault => {
            const found = this.allVaults.findIndex(item => item.data.token_address === vault.data.token_address);
            if (found > -1) {
                this.allVaults[found].data = vault.data;
            }
        })

        return this.allVaults;
    }

    get vaults() {
        return this.allVaults;
    }
}
