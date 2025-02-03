use anchor_client::solana_client::rpc_response::RpcSimulateTransactionResult;
use anchor_client::RequestBuilder;
use anchor_client::{
    solana_client::rpc_response::Response,
    solana_sdk::{signature::Signer, transaction::Transaction},
    Program,
};
use core::ops::Deref;

pub fn parse_event_log<
    T: anchor_lang::AnchorDeserialize + anchor_lang::AnchorSerialize + anchor_lang::Discriminator,
>(
    logs: &Vec<String>,
) -> Option<T> {
    for log in logs.iter() {
        if log.starts_with("Program data:") {
            // Skip the prefix "Program data: "
            // Event logged has been changed to Program data: instead of Program log:
            // https://github.com/project-serum/anchor/pull/1608/files
            let log_info: String = log.chars().skip(14).collect();
            let log_buf = anchor_lang::__private::base64::decode(log_info.as_bytes());
            if log_buf.is_ok() {
                let log_buf = log_buf.unwrap();
                // Check for event discriminator, it is a 8-byte prefix
                if log_buf[0..8] == T::discriminator() {
                    // Skip event discriminator when deserialize
                    return T::try_from_slice(&log_buf[8..]).ok();
                }
            }
        }
    }
    None
}

pub fn simulate_transaction<C: Deref<Target = impl Signer> + Clone>(
    builder: &RequestBuilder<C>,
    program: &Program<C>,
    signers: &Vec<&dyn Signer>,
) -> Result<Response<RpcSimulateTransactionResult>, Box<dyn std::error::Error>> {
    let instructions = builder.instructions()?;
    let rpc_client = program.rpc();
    let recent_blockhash = rpc_client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &instructions,
        Some(&program.payer()),
        signers,
        recent_blockhash,
    );
    let simulation = rpc_client.simulate_transaction(&tx)?;
    Ok(simulation)
}
