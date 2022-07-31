const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("RNG", function () {
  
  async function deployRNG() {
    
    const [owner, player1, player2, player3] = await ethers.getSigners();

    const RNG = await ethers.getContractFactory("RNG");
    const rng = await RNG.deploy();

    return { rng, owner, player1, player2, player3 };
  }

  describe("Deployment", function () {
    it("Should deploy correctly to an address", async function () {
      const { rng, owner, player1, player2, player3 } = await loadFixture(deployRNG);
      
      expect(rng.address).to.not.be.null;
    });
  });

  describe("Random number generation", function () {
    it("Should provide a valid request ID", async function () {
      const { rng, owner, player1, player2, player3 } = await loadFixture(deployRNG);
      
      const request_id = await rng.request();

      expect(request_id.data).to.not.be.null;
    });

    it("Should provide a random number", async function () {
      const { rng, owner, player1, player2, player3 } = await loadFixture(deployRNG);
      
      const request = await rng.request();
      expect(request.data).to.not.be.null;

      const request_id = await rng.current_request_id();
      expect(request_id).to.not.be.null;
      
      // const random_number = await rng.getRandomNumber(ethers.utils.formatBytes32String(request_id));
      let random_number = await rng.getRandomNumber(request_id);
      expect(random_number.toNumber()).to.equal(0);

      ethers.provider.send("evm_increaseTime", [11]);
      ethers.provider.send("evm_mine");

      random_number = await rng.getRandomNumber(request_id);
      expect(random_number.toNumber()).to.be.above(0);
    });
  });
});
