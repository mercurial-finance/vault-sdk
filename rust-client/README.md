
# CLI for mercurial vault

## Build

`cargo build`

## Command

Check command with `../target/debug/rust-client --help`

```
USAGE:
    rust-client [OPTIONS] <SUBCOMMAND>

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
    get-unlocked-amount    
    help                   Print this message or the help of the given subcommand(s)
    show                   
    withdraw                
```


## Example

```
../target/debug/rust-client show --provider.token_mint So11111111111111111111111111111111111111112

../target/debug/rust-client deposit 100 --provider.token_mint So11111111111111111111111111111111111111112

../target/debug/rust-client withdraw 100 --provider.token_mint So11111111111111111111111111111111111111112
```