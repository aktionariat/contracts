// const ConvertLib = artifacts.require("ConvertLib");
const SafeMath = artifacts.require("SafeMath");
// const MetaCoin = artifacts.require("MetaCoin");

module.exports = function(deployer) {
  // deployer.deploy(ConvertLib);
  deployer.deploy(SafeMath);
  // deployer.link(ConvertLib, MetaCoin);
  // deployer.deploy(MetaCoin);
};
