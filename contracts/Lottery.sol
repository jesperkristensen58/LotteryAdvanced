// SPDX-License-Identifier: MIT
pragma solidity ^0.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "@pooltogether/uniform-random-number/contracts/UniformRandomNumber.sol";

/*
@notice The interface of the RNG contract
@dev we require a request() function to get the request ID back.
@dev we require a getRandomNumber() function to get the random number corresponding to the request ID.
*/
interface RNGInterface {
    function request() external returns(bytes32);
    function getRandomNumber(bytes32 requestID) external view returns(uint256);
}

/*
@title Lottery Contract. Users can enter into the lottery and be picked at random with winning probability proportional to the contributed amount of ether.
@author Jesper Kristensen
@notice You can enter the lottery and your winnings are in proportion to amount contributed. Simply send ether to the contract address to enter.
*/
contract Lottery is Ownable, Pausable {
    bool public finished;  // we can check if the Lottery is finished
    uint256 lotteryDurationSeconds;
    uint256 lotteryEndTime;
    bytes32 rng_request_id;
    address rngContractAddress;  // RNG contract from which we draw random numbers
    RNGInterface RNGContract;
    uint256 private lottery_number;
    bytes32 private tree_key;
    uint256 constant private MAX_TREE_LEAVES = 5;

    // Odds weighed by contribution from each participant
    using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;
    SortitionSumTreeFactory.SortitionSumTrees sumTreeFactory;

    /// @notice construct the Lottery contract and set the duration and point to the RNG contract which must already be deployed
    /// @param _lotteryDurationSeconds The number of seconds the Lottery is open for. From now till now + _lotteryDurationSeconds the lottery contract accepts wagers from anyone. This can be changed post-deployment by the contract owner.
    /// @param _rngContractAddress The contract address of the Random Number Generator (RNG) deployed contract. This can be changed post-deployment by the contract owner.
    constructor(uint256 _lotteryDurationSeconds, address _rngContractAddress) public {
        // Create the lottery contract by setting the initial duration from the creator and set the RNG contract address too
        assert(_lotteryDurationSeconds > 0);
        lotteryDurationSeconds = _lotteryDurationSeconds;
        lotteryEndTime = now + lotteryDurationSeconds;

        rngContractAddress = _rngContractAddress;
        RNGContract = RNGInterface(rngContractAddress);

        tree_key = getTreeKey();
        sumTreeFactory.createTree(tree_key, MAX_TREE_LEAVES);  // start our sortition sum tree
        assert(!paused());
    }

    /// @notice Anyone can send ether to the contract and will then automatically get entered into the contract if the Lottery is still active. Trigger an update to the Lottery by sending 0 eth.
    /// @dev the Lottery being active means it is not paused. Pausing it will mean that any eth sent to the contract are lost.
    receive() external payable {
        // handle all loterry contributions via payable
        finished = isLotteryFinished();

        if (finished) {
            // Pick a winner if relevant
            address payable winner;

            if (rng_request_id == 0) {
                // make a new request for a random number, and wait for it
                // (there will be one such request per lotterys)
                rng_request_id = RNGContract.request();
            }

            if (rng_request_id > 0) {
                // we have made the request, waiting for the random number now
                uint256 random_number = RNGContract.getRandomNumber(rng_request_id);

                // if the random number is ready, then draw winner
                // random_number = 0 means the number was not returned/the RNG contract is not ready
                if (random_number > 0) {
                    // we got it, so we can pick the winner now
                    winner = pickWinner(random_number);
                }
            }

            // did a winner get picked?
            if (winner != address(0)) {
                assert(paused());
                
                // reset internal state first
                _reset();

                // then send all of our funds to winner
                winner.transfer(address(this).balance);
                assert(address(this).balance == 0);
                return;
            }
        }

        if (finished)
            return;

        // accept the incoming wager into the lottery
        enter();
    }

    /// @dev make sure we cannot send ether *and* calldata
    fallback() external {
        // wagers should be submitted without calldata
        revert("Unknown error. Hint: Maybe submit wager without calldata?");
    }

    /*
    @notice Set a new lottery duration (only owner is allowed to call this function). Should only be called after the lottery is over and before the new lottery starts.
    @param newLotteryDurationSeconds The new Lottery duration in seconds. This does change the current ongoing Lottery as well so be careful!
    */
    function setLotteryDuration(uint256 newLotteryDurationSeconds) external onlyOwner {
        // set a new lottery duration
        lotteryDurationSeconds = newLotteryDurationSeconds;
    }

    /*
    @notice Set a new contract address of the RNG contract. Can be used to switch to a new random number generator.
    @dev The new RNG contract is instantiated against the interface in this file at the top.
    @param newRNGContractAddress The new RNG contract address to change to.
    */
    function setRNGContract(address newRNGContractAddress) external onlyOwner {
        // set a new random number generator contract
        rngContractAddress = newRNGContractAddress;
        RNGContract = RNGInterface(rngContractAddress);
    }

    /*
    @notice Allow the owner to pause this contract.
    */
    function pause() external onlyOwner {
        // in case the owner needs to pause for whatever reason
        _pause();
    }

    // *---------------------- PRIVATE ----------------------*

    /*
    @notice Enter the lottery. The caller is entered into the lottery by the amount sent to the contract.
    @dev this adds a leave to the Sortition Sum Tree.
    */
    function enter() private whenNotPaused {
        // Enter the sender into the lottery
        uint256 current_stake = sumTreeFactory.stakeOf(tree_key, bytes32(uint256(msg.sender)));
        uint256 new_stake = current_stake + msg.value;  // the same user can increase their stake

        sumTreeFactory.set(tree_key, new_stake, bytes32(uint256(msg.sender)));
    }

    function stakeOf(address _address) external view onlyOwner returns (uint256) {
        // Get the stake of any address
        return sumTreeFactory.stakeOf(tree_key, bytes32(uint256(_address)));
    }

    /*
    @notice A winner is picked at random. The more a person has contributed, the higher the chances of winning are.
    @param randomNumber The random number to pick a winner from.
    @return The winner of the Lottery. Will be 0x0 if no contributions have been made in the lottery.
    */
    function pickWinner(uint256 randomNumber) private view whenPaused returns (address payable) {
        uint256 bound = sumTreeFactory.total(tree_key);
        address payable selected;

        if (bound == 0)
            return address(0);
        
        uint256 token = UniformRandomNumber.uniform(randomNumber, bound);
        selected = payable(uint256(sumTreeFactory.draw(tree_key, token)));
        
        return selected;
    }

    /*
    @notice Check if the Lottery is finished. Finish it if relevant.
    @dev this can update the internal state to paused.
    @return True if the Lottery is finished.
    */
    function isLotteryFinished() private returns(bool) {
        // Check whether the lottery has ended
        if (paused())
            return true;
        
        // not paused, but should we pause?
        if (now > lotteryEndTime) {
            // pause it; no more wagers allowed, we are finished
            _pause();
            return true;
        }

        return false;
    }

    /*
    @notice Reset the Lottery state. Prepares for a new Lottery to start.
    @dev unpauses the Lottery contract.
    */
    function _reset() private whenPaused {
        // reset the lottery state
        rng_request_id = 0;
        lotteryEndTime = now + lotteryDurationSeconds;  // update the end time

        tree_key = getTreeKey();
        sumTreeFactory.createTree(tree_key, MAX_TREE_LEAVES);  // start our sortition sum tree

        _unpause();

        assert(!paused());

        // a new lottery has begun
    }

    /*
    @notice Compute and return a new tree key.
    @dev this key is what can start a new tree.
    @return the new sortition key
    */
    function getTreeKey() private returns(bytes32) {
        bytes32 curr_key = tree_key;

        lottery_number += 1;
        bytes32 new_tree_key = keccak256(abi.encodePacked("LotteryTest/Lottery", lottery_number));
        assert(curr_key != new_tree_key);
        
        return new_tree_key;
    }
}