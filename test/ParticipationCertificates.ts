import { expect } from "chai";
import { Contract } from "ethers";
import { ethers, owner, signer1 } from "./TestBase.ts";

// Tests for contracts/shares/base/ParticipationCertificates.sol and
// contracts/shares/sha/ParticipationCertificatesUnderAgreement.sol: the Shares / SharesUnderAgreement
// pair under the participation-certificate name, with the "P" / " PCHA" wrapper suffix.

const BASE = { symbol: "TST", name: "Test Company Participation Certificates", terms: "https://test.com/terms" };
const AGREEMENT_TERMS = "https://test.com/pcha";

describe("ParticipationCertificates (base + under agreement)", function () {
  let base: Contract;
  let wrapper: Contract;

  before(async () => {
    const PC = await ethers.getContractFactory("contracts/shares/base/ParticipationCertificates.sol:ParticipationCertificates");
    base = (await PC.deploy(BASE.symbol, BASE.name, BASE.terms, owner)) as unknown as Contract;
    const PCUA = await ethers.getContractFactory("contracts/shares/sha/ParticipationCertificatesUnderAgreement.sol:ParticipationCertificatesUnderAgreement");
    wrapper = (await PCUA.deploy(base, AGREEMENT_TERMS, owner)) as unknown as Contract;
  });

  it("is a Shares registry under its own name", async () => {
    expect(await base.symbol()).to.equal(BASE.symbol);
    expect(await base.name()).to.equal(BASE.name);
    expect(await base.terms()).to.equal(BASE.terms);
    expect(await base.VERSION()).to.equal(6n);
    expect(await base.decimals()).to.equal(0n);
  });

  it("derives the wrapper symbol/name with the PCHA suffix", async () => {
    expect(await wrapper.symbol()).to.equal(BASE.symbol + "P");
    expect(await wrapper.name()).to.equal(BASE.name + " PCHA");
    expect(await wrapper.base()).to.equal(await base.getAddress());
    expect(await wrapper.terms()).to.equal(AGREEMENT_TERMS);
    expect(await wrapper.binding()).to.equal(true);
  });

  it("wraps like SharesUnderAgreement", async () => {
    await base.connect(owner).mintAndWrap(signer1, wrapper, 40n);
    expect(await wrapper.balanceOf(signer1)).to.equal(40n);
    expect(await base.balanceOf(wrapper)).to.equal(40n);
  });
});
