const got  = require("got");
const tough = require("tough-cookie");
require("dotenv").config();

const adminkey = process.env.AKTIONARIAT_API_KEY
const cookie= process.env.AKTIONARIAT_API_COOKIE
const cookieJar = new tough.CookieJar();
cookieJar.setCookie('user='+cookie, process.env.AKTIONARIAT_API_URL);
const backendAPI = got.extend({prefixUrl: process.env.AKTIONARIAT_API_URL}, {cookieJar})

async function getCompanyId(companyName) {
  const response = await backendAPI(`findcompany?query=${companyName}`).json();
  return response.ids[0];
}

async function registerMultiSignature(companyId, multisigAddress){
  await backendAPI.post(`registermultisig?address=${multisigAddress}&company=${companyId}`);
}

async function registerToken(companyId, tokenAddress, blockNumber) {
  await backendAPI.post(`registertoken?address=${tokenAddress}&company=${companyId}&creationBlock=${blockNumber}`);
}

async function registerBrokerbot(brokerbotAddress) {
  await backendAPI.post(`registerbrokerbot?address=${brokerbotAddress}`);
}

module.exports = { getCompanyId, registerMultiSignature, registerToken, registerBrokerbot };
