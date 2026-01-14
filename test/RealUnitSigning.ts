
import { deployer } from "./TestBase.ts";

describe("RealUnit External User Registration", function () {

  it("Should sign user details object", async function () {
      const exampleUser: RealUnitUserRegistration = {
        email: "test-direct@dfx.swiss",
        name: "Test Direct",
        type: "HUMAN",
        phoneNumber: "+41791234567",
        birthday: "1990-01-15",
        nationality: "CH",
        addressStreet: "Teststrasse 1",
        addressPostalCode: "8000",
        addressCity: "Zurich",
        addressCountry: "CH",
        swissTaxResidence: true,
        registrationDate: "2025-12-17",
        walletAddress: "0xD29C323DfD441E5157F5a05ccE6c74aC94c57aAd"
      }

      const { domain, types, message } = getEIP712Fields(exampleUser);
      let signature = await deployer.signTypedData(domain, types, message);  
      console.log("Signature:", signature);
      console.log("Signer Address:", await deployer.getAddress());
  });
});

interface RealUnitUserRegistration {
    email: string;
    name: string;
    type: string;
    phoneNumber: string;
    birthday: string;
    nationality: string;
    addressStreet: string;
    addressPostalCode: string;
    addressCity: string;
    addressCountry: string;
    swissTaxResidence: boolean;
    registrationDate: string;
    walletAddress: string;
    countryAndTINs?: Array<{country: string, tin: string}>;
}

function getEIP712Fields(user: RealUnitUserRegistration) {
  const domain = {
    name: 'RealUnitUser',
    version: '1'
  };

  const types = {
    RealUnitUser: [
      { name: 'email', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'type', type: 'string' },
      { name: 'phoneNumber', type: 'string' },
      { name: 'birthday', type: 'string' },
      { name: 'nationality', type: 'string' },
      { name: 'addressStreet', type: 'string' },
      { name: 'addressPostalCode', type: 'string' },
      { name: 'addressCity', type: 'string' },
      { name: 'addressCountry', type: 'string' },
      { name: 'swissTaxResidence', type: 'bool' },
      { name: 'registrationDate', type: 'string' },
      { name: 'walletAddress', type: 'address' }
    ]
  };

  const message = user;

  return { domain, types, message };
}