const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { success } = require("../utils/respond");

/**
 * Generates a signed JWT for a user.
 */
const signToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET || "foresite_dev_jwt_secret_change_in_production",
    { expiresIn: "7d" }
  );
};

/**
 * Formats user for public response (no password).
 */
const formatUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  isActive: user.isActive,
});

/**
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;

<<<<<<< HEAD
=======
    // Validate required fields
>>>>>>> 576e47a (Database fix)
    if (!name || !email || !password) {
      return next(ApiError.badRequest("name, email, and password are required"));
    }

<<<<<<< HEAD
    const validRoles = ["worker", "safety_officer", "maintenance", "admin", "manager", "technician"];
    const userRole = role && validRoles.includes(role) ? role : "worker";

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
=======
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
>>>>>>> 576e47a (Database fix)
      return next(ApiError.conflict("Email is already registered"));
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
<<<<<<< HEAD
      role: userRole,
      department: department || "General",
=======
      role: role || "worker",
      department: department || "Safety Operations",
>>>>>>> 576e47a (Database fix)
    });

    // Update lastLogin
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    // Generate token
    const token = signToken(user);

    success(res, { user: formatUser(user), token }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

<<<<<<< HEAD
=======
    // Validate required fields
>>>>>>> 576e47a (Database fix)
    if (!email || !password) {
      return next(ApiError.badRequest("email and password are required"));
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return next(ApiError.unauthorized("Invalid email or password"));
    }

<<<<<<< HEAD
=======
    // Check if account is active
>>>>>>> 576e47a (Database fix)
    if (!user.isActive) {
      return next(ApiError.forbidden("Account has been deactivated"));
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return next(ApiError.unauthorized("Invalid email or password"));
    }

    // Update lastLogin
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    // Generate token
    const token = signToken(user);

    success(res, { user: formatUser(user), token });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
exports.getMe = async (req, res, next) => {
  try {
    success(res, formatUser(req.user));
  } catch (err) {
    next(err);
  }
};
