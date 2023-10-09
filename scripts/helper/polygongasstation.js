const { ethers } = require("ethers");


/*async function getGasPrice() {
  fetch('https://gasstation.polygon.technology/v2')
  .then(response => response.json())
  .then(json => {
    console.log(json);
    let feeData;
    feeData.maxPriorityFeePerGas = json.fast.maxPriorityFeePerGas;
    feeData.maxFeePerGas = json.fast.maxFee;
    feeData.baseFee = json.estimatedBaseFee;
    return feeData;
  })
}*/

async function getGasPrice() {
  try {
    const response = await fetch('https://gasstation.polygon.technology/v2');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const json = await response.json();
    const feeData = {
      maxPriorityFeePerGas: ethers.utils.parseUnits(Math.ceil(json.fast.maxPriorityFee,) + '', 'gwei'),
      maxFeePerGas: ethers.utils.parseUnits(Math.ceil(json.fast.maxFee) + '', 'gwei'),
      baseFee: ethers.utils.parseUnits(Math.ceil(json.estimatedBaseFee) + '', 'gwei'),
    };
    console.log(feeData); // You can log feeData here
    return feeData; // Return the feeData object
  } catch (error) {
    console.error('Fetch error:', error);
    throw error; // Rethrow the error to be handled by the caller
  }
}

module.exports = {
  getGasPrice
};
