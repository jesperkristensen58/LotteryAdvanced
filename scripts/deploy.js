const hre = require("hardhat");

async function main() {
  // FIRST DEPLOY THE RNG CONTRACT
  const RNG = await hre.ethers.getContractFactory("RNG");
  const rng = await RNG.deploy();
  await rng.deployed();

  const rng_address = rng.address;

  console.log("RNG contract deployed to:", rng_address);

  // NOW DEPLOY THE LOTTERY CONTRACT POINTING TO THE RNG
  const lotteryDuration = 100;
  
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy(lotteryDuration, rng_address);
  await lottery.deployed();

  console.log("Lottery contract deployed to:", lottery.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
