//! Tulip adapter

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use mercurial_vault::strategy::base::get_tulip_program_id;
use std::io::Write;
use std::ops::Deref;
use tulipv2_sdk_common::lending::reserve::Reserve;

/// Anchor wrapper for Tulip Reserve
#[derive(Clone)]
pub struct TulipReserve(Reserve);

impl anchor_lang::AccountDeserialize for TulipReserve {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        TulipReserve::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let reserve = Reserve::unpack(buf)?;
        Ok(TulipReserve(reserve))
    }
}

impl anchor_lang::AccountSerialize for TulipReserve {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for TulipReserve {
    fn owner() -> Pubkey {
        get_tulip_program_id()
    }
}

impl Deref for TulipReserve {
    type Target = Reserve;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
