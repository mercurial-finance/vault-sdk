// Rust implementation of https://github.com/Francium-DeFi/francium-sdk/blob/master/src/constants/lend/pools.ts#L9
use anchor_lang::prelude::Pubkey;
use anchor_lang::prelude::*;

#[derive(AnchorDeserialize, Debug)]
pub struct LendingPool {
    pub version: u8,
    pub last_update_slot: u64,
    pub last_update_stale: u8,
    pub lending_market: Pubkey,
    pub liquidity_mint_pubkey: Pubkey,
    pub liquidity_mint_decimals: u8,
    pub liquidity_supply_pubkey: Pubkey,
    pub liquidity_fee_receiver: Pubkey,
    pub oracle: Oracle,
    pub liquidity_available_amount: u64,
    pub liquidity_borrowed_amount_wads: [u8; 16],
    pub liquidity_cumulative_borrow_rate_wads: [u8; 16],
    pub liquidity_market_price: [u8; 8],
    pub share_mint_pubkey: Pubkey,
    pub share_mint_total_supply: [u8; 8],
    pub share_supply_pubkey: Pubkey,
    pub credit_mint_pubkey: Pubkey,
    pub credit_mint_total_supply: [u8; 8],
    pub credit_supply_pubkey: Pubkey,
    pub threshold_1: u8,
    pub threshold_2: u8,
    pub base_1: u8,
    pub factor_1: u8,
    pub base_2: u8,
    pub factor_2: u8,
    pub base_3: u8,
    pub factor_3: u8,
    pub interest_reverse_rate: u8,
    pub accumulated_interest_reverse: u64,
    pub padding: Padding,
}

impl AccountDeserialize for LendingPool {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        let pool = LendingPool::deserialize(buf)?;
        Ok(pool)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        Self::try_deserialize(buf)
    }
}

#[derive(Debug)]
pub struct Oracle([u8; 36]);

impl AnchorDeserialize for Oracle {
    fn deserialize(buf: &mut &[u8]) -> std::io::Result<Self> {
        let mut oracle_buf_slice = [0u8; 36];
        oracle_buf_slice.copy_from_slice(&buf[..36]);
        *buf = &buf[36..];
        Ok(Self(oracle_buf_slice))
    }
}

#[derive(Debug)]
pub struct Padding([u8; 108]);

impl AnchorDeserialize for Padding {
    fn deserialize(buf: &mut &[u8]) -> std::io::Result<Self> {
        Ok(Self([0u8; 108]))
    }
}

#[test]
fn test_lending_pool_deserialize() {
    use anchor_client::solana_client::rpc_client::RpcClient;
    use anchor_client::Cluster;
    use solana_sdk::pubkey;

    let USDC_LENDING_POOL = pubkey!("Hx6LbkMHe69DYawhPyVNs8Apa6tyfogfzQV6a7XkwBUU");

    // https://github.com/Francium-DeFi/francium-sdk/blob/master/src/constants/lend/pools.ts#L9
    let MARKET_INFO = pubkey!("4XNif294wbrxj6tJ8K5Rg7SuaEACnu9s2L27i28MQB6E");
    let SHARE_MINT = pubkey!("62fDf5daUJ9jBz8Xtj6Bmw1bh1DvHn8AG4L9hMmxCzpu");

    let rpc_client = RpcClient::new(Cluster::Mainnet.url());

    let account_buffer = rpc_client.get_account_data(&USDC_LENDING_POOL).unwrap();
    let pool_info = LendingPool::try_deserialize(&mut account_buffer.as_ref()).unwrap();

    assert_eq!(pool_info.lending_market, MARKET_INFO);
    assert_eq!(pool_info.share_mint_pubkey, SHARE_MINT);
}
