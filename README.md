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
