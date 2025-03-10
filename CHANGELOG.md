# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## @meteora-ag/vault-sdk[2.3.1] - PR [#135](https://github.com/mercurial-finance/vault-sdk/pull/135)

### Changed

- remove `@solana/spl-token-registry` deps

## @meteora-ag/vault-sdk[2.3.0] - PR [#134](https://github.com/mercurial-finance/vault-sdk/pull/134)

### Changed

- move to `meteora-ag` org

## @mercurial-finance/vault-sdk [2.2.1] - PR [#131](https://github.com/mercurial-finance/vault-sdk/pull/131)

### Added

- new utils `deserializeMint`

## @mercurial-finance/vault-sdk [2.2.0] - PR [#130](https://github.com/mercurial-finance/vault-sdk/pull/130)

### Fixed

- fix `tokenMint` & `tokenLpMint`

### Removed

- remove `lpMintPda` field

## @mercurial-finance/vault-sdk [2.1.1] - PR [#129](https://github.com/mercurial-finance/vault-sdk/pull/129)

### Changed

- update `createMultiple` & `createMultiplePda` to optimize rpc call

## @mercurial-finance/vault-sdk [2.1.0] - PR [#128](https://github.com/mercurial-finance/vault-sdk/pull/128)

### Fixed

- fix `createMultiple` to take in less param

## @mercurial-finance/vault-sdk [2.0.1] - PR [#126](https://github.com/mercurial-finance/vault-sdk/pull/126)

### Fixed

- fix `refreshVaultState` not working

## @mercurial-finance/vault-sdk [2.0.0] - PR [#124](https://github.com/mercurial-finance/vault-sdk/pull/124)

### Changed

- Pump "@solana/spl-token" to 0.4.6 and various relevant packages

### Removed

- Remove logic to withdraw directly from strategy
