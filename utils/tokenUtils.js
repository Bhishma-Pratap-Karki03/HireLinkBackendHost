const jwt = require("jsonwebtoken");

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET ||
      "HireLink_Development_Secret_2024_Change_In_Production",
    { expiresIn: "2h" }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET ||
        "HireLink_Development_Secret_2024_Change_In_Production"
    );
  } catch (error) {
    return null;
  }
};

module.exports = { generateToken, verifyToken };
