/**
* SPDX-License-Identifier: LicenseRef-Aktionariat
*
* MIT License with Automated License Fee Payments
*
* Copyright (c) 2020 Aktionariat AG (aktionariat.com)
*
* Permission is hereby granted to any person obtaining a copy of this software
* and associated documentation files (the "Software"), to deal in the Software
* without restriction, including without limitation the rights to use, copy,
* modify, merge, publish, distribute, sublicense, and/or sell copies of the
* Software, and to permit persons to whom the Software is furnished to do so,
* subject to the following conditions:
*
* - The above copyright notice and this permission notice shall be included in
*   all copies or substantial portions of the Software.
* - All automated license fee payments integrated into this and related Software
*   are preserved.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/
pragma solidity >=0.8;

import "./IERC20.sol";

/**
 * @title Acquisition Attempt
 * @author Luzius Meisser, luzius@aktionariat.com
 */

contract Offer {

    uint256 public quorum;                              // Percentage of votes needed to start drag-along process

    address public token;
    address public buyer;                               // who made the offer
    
    address public currency;
    uint256 public price;                               // the price offered per share

    enum Vote { NONE, YES, NO }                         // Used internally, represents not voted yet or yes/no vote.
    mapping (address => Vote) private votes;            // Who votes what
    uint256 public noVotes;                             // number of tokens voting for no
    uint256 public yesVotes;                            // number of tokens voting for yes
    uint256 public voteEnd;

    event VotesChanged(uint256 newYesVotes, uint256 newNoVotes);
    event OfferCreated(address indexed buyer, address token, uint256 pricePerShare, address currency);
    event OfferEnded(address indexed buyer, bool success, string message);

    constructor (address buyer_, address token_, uint256 price_, address currency_, uint256 quorum_, uint256 votePeriod) payable {
        buyer = buyer_;
        token = token_;
        currency = currency_;
        price = price_;
        quorum = quorum_;
        voteEnd = block.timestamp + votePeriod;
        // License Fee to Aktionariat AG, also ensures that offer is serious.
        // Any circumvention of this license fee payment is a violation of the copyright terms.
        payable(0x29Fe8914e76da5cE2d90De98a64d0055f199d06D).transfer(3 ether);
        emit OfferCreated(buyer, token, price, currency);
    }

    function contest(address betterOffer) public {
        require(msg.sender == token);
        Offer better = Offer(betterOffer);
        require(currency == better.currency() && better.price() > price, "New offer must be better");
        kill(false, "replaced");
    }

    function hasExpired() internal view returns (bool) {
        return block.timestamp > voteEnd + 3 days; // buyer has three days to complete acquisition after voting ends
    }

    function contest() public {
        if (hasExpired()) {
            kill(false, "Expired");
        } else if (quorumHasFailed()) {
            kill(false, "Not enough support");
        } else if (!isWellFunded()) {
            kill(false, "Insufficient funds");
        }
    }

    function cancel() public {
        require(msg.sender == buyer);
        kill(false, "Cancelled");
    }

    function execute() public {
        require(isQuorumReached(), "Insufficient support");
        uint256 totalPrice = getTotalPrice();
        require(IERC20(currency).transferFrom(buyer, token, totalPrice));
        IDraggable(token).drag(buyer, currency);
        kill(true, "success");
    }

    function getTotalPrice() internal view returns (uint256) {
        IERC20 tok = IERC20(token);
        return (tok.totalSupply() - tok.balanceOf(buyer)) * price;
    }

    function isWellFunded() public view returns (bool) {
        IERC20 cur = IERC20(currency);
        uint256 buyerBalance = cur.balanceOf(buyer);
        uint256 buyerAllowance = cur.allowance(buyer, address(this));
        uint256 totalPrice = getTotalPrice();
        return totalPrice <= buyerBalance && totalPrice <= buyerAllowance;
    }

    function isQuorumReached() public view returns (bool) {
        if (isVotingOpen()) {
            // is it already clear that 75% will vote yes even though the vote is not over yet?
            return yesVotes * 10000  >= quorum * IERC20(token).totalSupply();
        } else {
            // did 75% of all cast votes say 'yes'?
            return yesVotes * 10000 >= quorum * (yesVotes + noVotes);
        }
    }

    function quorumHasFailed() public view returns (bool) {
        if (isVotingOpen()) {
            // is it already clear that 25% will vote no even though the vote is not over yet?
            return (IERC20(token).totalSupply() - noVotes) * 10000 < quorum * IERC20(token).totalSupply();
        } else {
            // did quorum% of all cast votes say 'no'?
            return 10000 * yesVotes < quorum * (yesVotes + noVotes);
        }
    }

    function notifyMoved(address from, address to, uint256 value) public {
        require(msg.sender == token);
        if (isVotingOpen()) {
            Vote fromVoting = votes[from];
            Vote toVoting = votes[to];
            update(fromVoting, toVoting, value);
        }
    }

    function update(Vote previousVote, Vote newVote, uint256 votes_) internal {
        if (previousVote != newVote) {
            if (previousVote == Vote.NO) {
                noVotes = noVotes - votes_;
            } else if (previousVote == Vote.YES) {
                yesVotes = yesVotes - votes_;
            }
            if (newVote == Vote.NO) {
                noVotes = noVotes + votes_;
            } else if (newVote == Vote.YES) {
                yesVotes = yesVotes + votes_;
            }
            emit VotesChanged(yesVotes, noVotes);
        }
    }

    function isVotingOpen() public view returns (bool) {
        return block.timestamp <= voteEnd;
    }

    modifier votingOpen() {
        require(isVotingOpen(), "The vote has ended.");
        _;
    }

    function voteYes() public {
        vote(Vote.YES);
    }

    function voteNo() public { 
        vote(Vote.NO);
    }

    function vote(Vote newVote) internal votingOpen() {
        Vote previousVote = votes[msg.sender];
        votes[msg.sender] = newVote;
        update(previousVote, newVote, IERC20(token).balanceOf(msg.sender));
    }

    function hasVotedYes(address voter) public view returns (bool) {
        return votes[voter] == Vote.YES;
    }

    function hasVotedNo(address voter) public view returns (bool) {
        return votes[voter] == Vote.NO;
    }

    function kill(bool success, string memory message) internal {
        IDraggable(token).notifyOfferEnded();
        emit OfferEnded(buyer, success, message);
        selfdestruct(payable(buyer));
    }

}

abstract contract IDraggable {

    function drag(address buyer, address currency) public virtual;
    function notifyOfferEnded() public virtual;

}