use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use mercurial_vault::strategy::base::get_solend_program_id;
use solend_program::state::{Obligation, Reserve};
use std::io::Write;
use std::ops::Deref;
#[derive(Clone)]
pub struct SolendObligation(Obligation);

impl SolendObligation {
    pub fn get_obligation(&self) -> Obligation {
        return self.0.clone();
    }
}

impl anchor_lang::AccountDeserialize for SolendObligation {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        SolendObligation::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let obligation = Obligation::unpack(buf)?;
        Ok(SolendObligation(obligation))
    }
}

impl anchor_lang::AccountSerialize for SolendObligation {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for SolendObligation {
    fn owner() -> Pubkey {
        get_solend_program_id()
    }
}

impl Deref for SolendObligation {
    type Target = Obligation;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone, Debug)]
pub struct SolendReserve(Reserve);

impl anchor_lang::AccountDeserialize for SolendReserve {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        SolendReserve::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let reserve = Reserve::unpack(buf)?;
        Ok(SolendReserve(reserve))
    }
}

impl anchor_lang::AccountSerialize for SolendReserve {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for SolendReserve {
    fn owner() -> Pubkey {
        get_solend_program_id()
    }
}

impl Deref for SolendReserve {
    type Target = Reserve;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
