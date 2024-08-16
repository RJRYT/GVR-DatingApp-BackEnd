/**
 * @title Dating App
 * 
 * Importing "dotenv" package to manage .env variables
 */
require("dotenv").config({ path: "./src/.env" });

/**
 * Express app 
 */
const app = require("./app");

/**
 * Server port
 */
const PORT = process.env.PORT || 5000;

/**
 * Listening to port
 */
app.listen(PORT, () => {
  console.log("+++++++++++++++++++++++++++++++++++++++++++++");
  console.log(`[Server]: Api server is running on port ${PORT}.`);
  console.log("+++++++++++++++++++++++++++++++++++++++++++++");
});
