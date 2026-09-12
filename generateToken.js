const jwt = require("jsonwebtoken");

const token = jwt.sign(
  { userId: "PUT_REAL_USER_ID_HERE" },
  process.env.JWT_SECRET || "foresite_dev_jwt_secret_change_in_production",
  { expiresIn: "7d" }
);

console.log(token);