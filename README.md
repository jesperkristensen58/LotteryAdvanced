# Lottery Contract

This project is the result of a Solidity test about building a Lottery contract with a corresponding Random number generator.

Prereqs:

You will need a `.env` file with your Alchemy and Goerli private key (NOTE: do not use an account where you have real money on mainnet).

Run:

```shell
npx hardhat test
```
To compile and test.

Then

```shell
npx hardhat run scripts/deploy.js --network goerli
```
To deploy to Goerli.

To compile in standalone mode, run:

```shell
npx hardhat compile
```

To test:
```shell
npx hardhat test
```

To verify (this is on the Goerli testnet):

First verify the RNG contract (get the address when you deploy):

```shell
npx hardhat verify 0x9047A22Ca6f9121d0edF1E7F855A0606dbC0CdA1 --network goerli
```

Then verify the Lottery contract (it takes 2 constructor args, first being the duration in seconds of the lottery the other the address of the RNG contract):

```shell
npx hardhat verify 0x86a4Fd205791639243E8dA9b829f8EEE7153dF4f --network goerli "100" "0x9047A22Ca6f9121d0edF1E7F855A0606dbC0CdA1"
```
