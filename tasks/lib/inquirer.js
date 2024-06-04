const inquirer = require('inquirer');

module.exports = {
  // needed for company id
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

  // ===============================
  // questions for deployment
  // ===============================
  askDeployConfig: () => {
    const questions = [
      {
        name: 'companyName',
        type: 'input',
        message: 'Enter the name of the company (which is used to get the id from):',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter then name of the company.';
          }
        }
      },
      {
        name: 'multisigSigner',
        type: 'input',
        message: 'Enter the first signer address of the multisig:',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter address of first signer.';
          }
        }
    },
      {
        name: 'symbol',
        type: 'input',
        message: 'Enter the symbol of the shares:',
        validate: function( value ) {
          if (value.length) {
            return true;
          } else {
            return 'Please enter the symbol of the shares.';
          }
        }
    },
    {
      name: 'shareName',
      type: 'input',
      message: 'Enter the name of the base share:',
      validate: function( value ) {
        if (value.length) {
          return true;
        } else {
          return 'Please enter the name of the share.';
        }
      }
    },
    {
      name: 'terms',
      type: 'input',
      message: 'Enter the terms of the shares:',
      validate: function( value ) {
        if (value.length) {
          return true;
        } else {
          return 'Please enter the terms of the company.';
        }
      }
    },
    {
      name: 'totalNumber',
      type: 'input',
      message: 'Enter the total number of shares:',
      validate: function( value ) {
        if (!isNaN(value)) {
          return true;
        } else {
          return 'Please enter the total number of shares.';
        }
      }
    },
    {
      name: 'price',
      type: 'input',
      message: 'Enter the price per share (in CHF):',
      validate: function( value ) {
        if (!isNaN(value) && value.length) {
          return true;
        } else {
          return 'Please enter the price per share.';
        }
      }
    },
    {
      name: 'increment',
      type: 'inupt',
      message: 'Enter the increment per share bought (in CHF):',
      default: 0,
      validate: function( value ) {
        if (!isNaN(value) && value.length) {
          return true;
        } else {
          return 'Please enter increment.';
        }
      }
    },
    {
      name: 'quorum',
      type: 'inupt',
      message: 'Enter the quorum in %:',
      default: 75,
      validate: function( value ) {
        if (!isNaN(value)) {
          return true;
        } else {
          return 'Please enter quorum.';
        }
      }
    },
    {
      name: 'quorumMigration',
      type: 'inupt',
      message: 'Enter the quorum for migration in %:',
      default: 75,
      validate: function( value ) {
        if (!isNaN(value)) {
          return true;
        } else {
          return 'Please enter quorum for migration.';
        }
      }
    },
    {
      name: 'votePeriod',
      type: 'inupt',
      message: 'Enter the voting period in days:',
      default: 60,
      validate: function( value ) {
        if (!isNaN(value)) {
          return true;
        } else {
          return 'Please enter voting period.';
        }
      }
    },
    {
      name: 'allowlist',
      type: 'confirm',
      message: 'Does the smartcontract needs allowlisting?',
      default: false,
    },
    {
      name: 'draggable',
      type: 'confirm',
      message: 'Does the smartcontract needs to be draggable?'
    },
    {
      name: 'deployBrokerbot',
      type: 'confirm',
      message: 'Does it need a Brokerbot contract?',
      default: true,
    },
    ]
    return inquirer.prompt(questions);
  },

  askConfirmWithMsg: (msg) => {
    const questions = [
      {
        name: 'confirm',
        type: 'confirm',
        message: msg
      }
    ];
    return inquirer.prompt(questions).then( answer => {return answer.confirm});
  },

  // ==============================
  // Brokerbot question
  // ==============================
  askPrice: () => {
    const questions = [
      {
        name: 'price',
        type: 'input',
        message: 'Enter the price per share (in CHF):',
        validate: function( value ) {
          if (!isNaN(value) && value.length) {
            return true;
          } else {
            return 'Please enter the price per share.';
          }
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.price});
  },
  askIncrement: () => {
    const questions = [
      {
        name: 'increment',
        type: 'inupt',
        message: 'Enter the increment per share bought (in CHF):',
        default: 0,
        validate: function( value ) {
          if (!isNaN(value) && value.length) {
            return true;
          } else {
            return 'Please enter increment.';
          }
        }
      }
    ]
    return inquirer.prompt(questions).then((answer) => {return answer.increment});
  },

  // ================================
  // register questions
  // =================================
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
          'Polygon'
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