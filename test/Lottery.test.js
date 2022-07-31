const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Lottery", function () {
  
  async function deployLottery() {
    
    const [owner, player1, player2, player3] = await ethers.getSigners();
    const RNG = await ethers.getContractFactory("RNG");
    const rng = await RNG.deploy();
    await rng.deployed()

    const Lottery = await ethers.getContractFactory("Lottery");
    const lottery = await Lottery.deploy(100, rng.address);
    await lottery.deployed()

    return { lottery, owner, player1, player2, player3 };
  }

  describe("Deployment", function () {
    it("Should deploy correctly to an address", async function () {
      const { lottery, owner, player1, player2, player3 } = await loadFixture(deployLottery);
      
      expect(lottery.address).to.not.be.null;
    });
  });

  describe("Access by owner", function () {

    it("Should be the correct owner", async function () {
      const { lottery, owner, player1, player2, player3 } = await loadFixture(deployLottery);

      const owner_of_contract = await lottery.owner();
      expect(owner_of_contract).to.equal(owner.address);
      expect(owner_of_contract).to.not.equal(player1.address);
      expect(owner_of_contract).to.not.equal(player2.address);
      expect(owner_of_contract).to.not.equal(player3.address);
    });
  });

  describe("Lottery features", function () {
    it("Should not be paused and not be finished on deployment", async function () {
      const { lottery, owner, player1, player2, player3 } = await loadFixture(deployLottery);

      const paused = await lottery.paused();
      expect(paused).to.equal(false);

      const finished = await lottery.finished();
      expect(finished).to.equal(false);
    });

    it("Should take wagers until paused", async function() {
      const { lottery, owner, player1, player2, player3 } = await loadFixture(deployLottery);

      let paused = await lottery.paused();
      expect(paused).to.equal(false);

      // Send some wagers
      let bal = await lottery.provider.getBalance(lottery.address);
      expect(bal.toNumber()).to.equal(0);

      await player1.sendTransaction(
        {
          to: lottery.address,
          value: ethers.utils.parseEther("0.1"),
        }
      );

      bal = await lottery.provider.getBalance(lottery.address);
      expect(bal).to.equal(ethers.utils.parseEther("0.1"));

      let finished = await lottery.finished();
      expect(finished).to.equal(false);

      ethers.provider.send("evm_increaseTime", [10]);
      ethers.provider.send("evm_mine");

      finished = await lottery.finished();
      expect(finished).to.equal(false);

      ethers.provider.send("evm_increaseTime", [91]);
      ethers.provider.send("evm_mine");

      // Send some wagers
      await player1.sendTransaction(
        {
          to: lottery.address,
          value: ethers.utils.parseEther("0.0000001"),
        }
      );
      bal = await lottery.provider.getBalance(lottery.address);
      expect(bal).to.equal(ethers.utils.parseEther("0.1000001"));

      let stake = await lottery.stakeOf(owner.address);
      expect(stake).to.equal(0);

      stake = await lottery.stakeOf(player1.address);
      expect(stake).to.equal(ethers.utils.parseEther("0.1"));

      finished = await lottery.finished();
      expect(finished).to.equal(true);

      paused = await lottery.paused();
      expect(paused).to.equal(true);
    });

    it("Should support multiple players and find winner as expected", async function() {
      const { lottery, owner, player1, player2, player3 } = await loadFixture(deployLottery);

      await owner.sendTransaction(
        {
          to: lottery.address,
          value: ethers.utils.parseEther("1"),
        }
      );
      let stake = await lottery.stakeOf(owner.address);
      expect(stake).to.equal(ethers.utils.parseEther("1"));
      
      await player1.sendTransaction(
        {
          to: lottery.address,
          value: ethers.utils.parseEther("1"),
        }
      );
      stake = await lottery.stakeOf(player1.address);
      expect(stake).to.equal(ethers.utils.parseEther("1"));

      await player2.sendTransaction(
        {
          to: lottery.address,
          value: ethers.utils.parseEther("1"),
        }
      );
      stake = await lottery.stakeOf(player2.address);
      expect(stake).to.equal(ethers.utils.parseEther("1"));

      stake = await lottery.stakeOf(player3.address);
      expect(stake).to.equal(ethers.utils.parseEther("0"));

      await player3.sendTransaction(
        {
          to: lottery.address,
          value: ethers.utils.parseEther("1"),
        }
      );
      stake = await lottery.stakeOf(player3.address);
      expect(stake).to.equal(ethers.utils.parseEther("1"));

      finished = await lottery.finished();
      expect(finished).to.equal(false);

      ethers.provider.send("evm_increaseTime", [200]);
      ethers.provider.send("evm_mine");

      // trigger the winner
      await owner.sendTransaction(
        {
          to: lottery.address,
          value: ethers.utils.parseEther("0.00000001"),
        }
      );

      // wait for the random number
      ethers.provider.send("evm_increaseTime", [11]);
      ethers.provider.send("evm_mine");

      await owner.sendTransaction(
        {
          to: lottery.address,
          value: ethers.utils.parseEther("0.00000001"),
        }
      );

      finished = await lottery.finished();
      expect(finished).to.equal(true);

      stake = await lottery.stakeOf(player1.address);
      expect(stake).to.equal(0);
      
    });

    it("Should send funds to the winner", async function() {
      const { lottery, owner, player1, player2, player3 } = await loadFixture(deployLottery);

        let initialbal = await lottery.provider.getBalance(lottery.address);

        await owner.sendTransaction(
          {
            to: lottery.address,
            value: ethers.utils.parseEther("1"),
          }
        );
        let stake = await lottery.stakeOf(owner.address);
        expect(stake).to.equal(ethers.utils.parseEther("1"));

        ethers.provider.send("evm_increaseTime", [200]);
        ethers.provider.send("evm_mine");

        // trigger the random number generation
        await owner.sendTransaction(
          {
            to: lottery.address,
            value: ethers.utils.parseEther("0.00000001"),
          }
        );

        let currbal = await lottery.provider.getBalance(lottery.address);
        expect(currbal).to.be.greaterThan(initialbal + ethers.utils.parseEther("0.9"));

        // wait for the random number
        ethers.provider.send("evm_increaseTime", [11]);
        ethers.provider.send("evm_mine");

        // finalize the win (after we get the random number)
        await owner.sendTransaction(
          {
            to: lottery.address,
            value: ethers.utils.parseEther("0.00000001"),
          }
        );

        currbal = await lottery.provider.getBalance(lottery.address);
        expect(currbal).to.equal(0);
    });
  });
});
