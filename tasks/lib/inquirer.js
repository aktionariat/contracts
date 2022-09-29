const inquirer = require('inquirer');

module.exports = {
  askCompanyName: () => {
    const questions = [
      {
        name: 'companyName',
        type: 'input',
        message: 'Enter the name of the company:',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter then name of the company.';
          }
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.companyName});
  },
  askCompanySymbol: () => {
    const questions = [
      {
        name: 'symbol',
        type: 'input',
        message: 'Enter the symbol of the company:',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter then symbol of the company.';
          }
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.symbol});
  },
  askMultiSigAddress: () => {
    const questions = [
      {
        name: 'address',
        type: 'input',
        message: 'Enter the address of the multisig:',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter the address.';
          }
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.address});
  },
  askTokenAddress: () => {
    const questions = [
      {
        name: 'address',
        type: 'input',
        message: 'Enter the address of the (draggable)share token:',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter the address.';
          }
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.address});
  },
  askBrokerbotAddress: () => {
    const questions = [
      {
        name: 'address',
        type: 'input',
        message: 'Enter the address of the brokerbot:',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter the address.';
          }
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.address});
  },
  askBlockNumber: () => {
    const questions = [
      {
        name: 'number',
        type: 'input',
        message: 'Enter the block number at which the token got deployed:',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter the block number.';
          }
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.number});
  },
  askNetwork: () => {
    const questions = [
      {
        name: 'network',
        type: 'list',
        message: 'Choose the network:',
        choices: [
          'Mainnet',
          'Optimism',
        ],
        filter(val) {
          return val.toLowerCase();
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.network});
  },
  askWhatToRegister: () => {
    const questions = [
      {
        name: 'register',
        type: 'checkbox',
        message: 'Select all addresse you want to register:',
        choices: [
          'MultiSig',
          'Token',
          'Brokerbot'
        ],
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.register});
  }

};