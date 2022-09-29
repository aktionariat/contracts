const got  = require("got");
require("dotenv").config();

const adminkey = process.env.AKTIONARIAT_API_KEY
const backendAPI = got.extend({prefixUrl: process.env.AKTIONARIAT_API_URL})

async function getCompanyId(companyName) {
  const response = await backendAPI(`findcompany?query=${companyName}&${adminkey}`).json();
  return response.ids[0];
}

async function registerMultiSignature(companyId, multisigAddress){
  await backendAPI.post(`registermultisig?address=${multisigAddress}&company=${companyId}&${adminkey}`);
}

async function registerToken(companyId, tokenAddress, blockNumber) {
  await backendAPI.post(`registertoken?address=${tokenAddress}&company=${companyId}&${adminkey}&creationBlock=${blockNumber}`);
}

async function registerBrokerbot(brokerbotAddress) {
  await backendAPI.post(`registerbrokerbot?address=${brokerbotAddress}&${adminkey}`);
}

module.exports = { getCompanyId, registerMultiSignature, registerToken, registerBrokerbot };