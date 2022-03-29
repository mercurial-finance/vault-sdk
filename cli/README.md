
# CLI for mercurial v2

## Build

`cargo build`

## Command

Check command with `vault-cli --help`

```
USAGE:
    vault-cli [OPTIONS] <SUBCOMMAND>

OPTIONS:
    -h, --help                                Print help information
        --provider.admin <ADMIN>              
        --provider.base <BASE>                
        --provider.cluster <CLUSTER>          Cluster override
        --provider.program_id <PROGRAM_ID>    Program id override
        --provider.token_mint <TOKEN_MINT>    Token mint override
        --provider.wallet <WALLET>            Wallet override

SUBCOMMANDS:
    deposit     
    help        Print this message or the help of the given subcommand(s)
    show        
    withdraw    
```