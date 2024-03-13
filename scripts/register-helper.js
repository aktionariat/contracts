const got  = require("got");
const tough = require("tough-cookie");
require("dotenv").config();

async function getCompanyId(companyName) {
  const api = getBackendAPI();
  const response = await api(`findcompany?query=${companyName}`).json();
  return response.ids[0];
}

async function registerMultiSignature(companyId, multisigAddress){
  const api = getBackendAPI();
  await api.post(`registermultisig?address=${multisigAddress}&company=${companyId}`);
}

async function registerToken(companyId, tokenAddress, blockNumber) {
  const api = getBackendAPI();
  await api.post(`registertoken?address=${tokenAddress}&company=${companyId}&creationBlock=${blockNumber}`);
}

async function registerBrokerbot(brokerbotAddress) {
  const api = getBackendAPI();
  await api.post(`registerbrokerbot?address=${brokerbotAddress}`);
}

function getBackendAPI() {
  const cookie= process.env.AKTIONARIAT_API_COOKIE
  const cookieJar = new tough.CookieJar();
  try {
    cookieJar.setCookie('user='+cookie, process.env.AKTIONARIAT_API_URL);
    const backendAPI = got.extend({prefixUrl: process.env.AKTIONARIAT_API_URL}, {cookieJar});
    return backendAPI;
  } catch (error) {
    console.log(error)
    return null;
  }
}

module.exports = { getCompanyId, registerMultiSignature, registerToken, registerBrokerbot };