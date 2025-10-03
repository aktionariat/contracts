


contract DeterrenceFee {

    uint96 public deterrenceFee;

    event DeterrenceFeePaid(address payer, uint96 fee);

    function payDeterrenceFee() internal payable {
        // Pay the deterrence fee to the Aktionariat ledger
        payable(0x29Fe8914e76da5cE2d90De98a64d0055f199d06D).call{value:deterrenceFee}("");
        emit DeterrenceFeePaid(msg.sender, deterrenceFee);
    }

    function setDeterrenceFee(uint96 fee) external onlyOwner {
        deterrenceFee = fee;
    }

}