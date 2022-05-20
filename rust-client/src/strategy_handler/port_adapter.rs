use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use port_variable_rate_lending_instructions::state::{Obligation, Reserve};
use std::io::Write;
use std::ops::Deref;

#[derive(Clone)]
pub struct PortObligation(Obligation);

impl PortObligation {
    pub fn get_obligation(&self) -> Obligation {
        return self.0.clone();
    }
}

impl anchor_lang::AccountDeserialize for PortObligation {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        PortObligation::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let obligation = Obligation::unpack(buf)?;
        Ok(PortObligation(obligation))
    }
}

impl anchor_lang::AccountSerialize for PortObligation {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for PortObligation {
    fn owner() -> Pubkey {
        port_variable_rate_lending_instructions::id()
    }
}

impl Deref for PortObligation {
    type Target = Obligation;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

pub struct PortReserve(Reserve);

impl anchor_lang::AccountDeserialize for PortReserve {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        PortReserve::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let reserve = Reserve::unpack(buf)?;
        Ok(PortReserve(reserve))
    }
}

impl anchor_lang::AccountSerialize for PortReserve {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for PortReserve {
    fn owner() -> Pubkey {
        port_variable_rate_lending_instructions::id()
    }
}

impl Deref for PortReserve {
    type Target = Reserve;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
