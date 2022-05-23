use anchor_lang::prelude::*;
use mango::state::{MangoAccount, MangoCache, MangoGroup, NodeBank, RootBank};
use mango_common::Loadable;
use mercurial_vault::strategy::base::{get_mango_group_id, get_mango_program_id};
use std::io::Write;
use std::ops::Deref;
#[derive(Clone)]
pub struct MangoRootBankAdapter(RootBank);

impl MangoRootBankAdapter {}

impl anchor_lang::AccountDeserialize for MangoRootBankAdapter {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        MangoRootBankAdapter::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let default_key = Pubkey::default();
        let mut lamport = 0u64;

        let mut buf = buf.to_owned();
        let account_info = AccountInfo::new(
            &default_key,
            false,
            false,
            &mut lamport,
            &mut buf,
            &default_key,
            false,
            0,
        );

        let state = RootBank::load_mut_checked(&account_info, &default_key).unwrap();

        Ok(MangoRootBankAdapter(*state.deref()))
    }
}

impl anchor_lang::AccountSerialize for MangoRootBankAdapter {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for MangoRootBankAdapter {
    fn owner() -> Pubkey {
        get_mango_program_id()
    }
}

impl Deref for MangoRootBankAdapter {
    type Target = RootBank;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone)]
pub struct MangoGroupAdapter(MangoGroup);

impl MangoGroupAdapter {}

impl anchor_lang::AccountDeserialize for MangoGroupAdapter {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        MangoGroupAdapter::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let default_key = Pubkey::default();
        let mut lamport = 0u64;

        let mut buf = buf.to_owned();
        let account_info = AccountInfo::new(
            &default_key,
            false,
            false,
            &mut lamport,
            &mut buf,
            &default_key,
            false,
            0,
        );

        let state = *MangoGroup::load_mut_checked(&account_info, &default_key)
            .unwrap()
            .deref();

        Ok(MangoGroupAdapter(state))
    }
}

impl anchor_lang::AccountSerialize for MangoGroupAdapter {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for MangoGroupAdapter {
    fn owner() -> Pubkey {
        get_mango_program_id()
    }
}

impl Deref for MangoGroupAdapter {
    type Target = MangoGroup;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone)]
pub struct MangoNodeBankAdapter(NodeBank);

impl MangoNodeBankAdapter {}

impl anchor_lang::AccountDeserialize for MangoNodeBankAdapter {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        MangoNodeBankAdapter::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let default_key = Pubkey::default();
        let mut lamport = 0u64;

        let mut buf = buf.to_owned();
        let account_info = AccountInfo::new(
            &default_key,
            false,
            false,
            &mut lamport,
            &mut buf,
            &default_key,
            false,
            0,
        );

        let state = *NodeBank::load_mut_checked(&account_info, &default_key)
            .unwrap()
            .deref();

        Ok(MangoNodeBankAdapter(state))
    }
}

impl anchor_lang::AccountSerialize for MangoNodeBankAdapter {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for MangoNodeBankAdapter {
    fn owner() -> Pubkey {
        get_mango_program_id()
    }
}

impl Deref for MangoNodeBankAdapter {
    type Target = NodeBank;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone)]
pub struct MangoAccountAdapter(MangoAccount);

impl MangoAccountAdapter {}

impl anchor_lang::AccountDeserialize for MangoAccountAdapter {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        MangoAccountAdapter::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let default_key = Pubkey::default();
        let mut lamport = 0u64;

        let mut buf = buf.to_owned();
        let account_info = AccountInfo::new(
            &default_key,
            false,
            false,
            &mut lamport,
            &mut buf,
            &default_key,
            false,
            0,
        );

        let mango_group_pk = get_mango_group_id();

        let state = *MangoAccount::load_mut_checked(&account_info, &default_key, &mango_group_pk)
            .unwrap()
            .deref();

        Ok(MangoAccountAdapter(state))
    }
}

impl anchor_lang::AccountSerialize for MangoAccountAdapter {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for MangoAccountAdapter {
    fn owner() -> Pubkey {
        get_mango_program_id()
    }
}

impl Deref for MangoAccountAdapter {
    type Target = MangoAccount;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone)]
pub struct MangoCacheAdapter(MangoCache);

impl MangoCacheAdapter {}

impl anchor_lang::AccountDeserialize for MangoCacheAdapter {
    fn try_deserialize(buf: &mut &[u8]) -> Result<Self> {
        MangoCacheAdapter::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        let default_key = Pubkey::default();
        let mut lamport = 0u64;

        let mut buf = buf.to_owned();
        let account_info = AccountInfo::new(
            &default_key,
            false,
            false,
            &mut lamport,
            &mut buf,
            &default_key,
            false,
            0,
        );

        let mango_group_pk = get_mango_group_id();

        let mango_cache = MangoCache::load_mut(&account_info)?;

        Ok(MangoCacheAdapter(*mango_cache))
    }
}

impl anchor_lang::AccountSerialize for MangoCacheAdapter {
    fn try_serialize<W: Write>(&self, _writer: &mut W) -> Result<()> {
        // no-op
        Ok(())
    }
}

impl anchor_lang::Owner for MangoCacheAdapter {
    fn owner() -> Pubkey {
        get_mango_program_id()
    }
}

impl Deref for MangoCacheAdapter {
    type Target = MangoCache;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
