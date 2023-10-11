const got  = require("got");
require("dotenv").config();
const { getCompanyId } = require("./register-helper");


async function main() {
  const name = "Polygon Example Company"
  const companyNr = await getCompanyId(name)
  console.log(companyNr)

  /*
  const {data} = await got.post('https://httpbin.org/anything', {
    json: {
      hello: 'world'
    }
  }).json()
  
  console.log(JSON.parse(data));
  */
  
  }
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });