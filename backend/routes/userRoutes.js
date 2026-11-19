// routes/userRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { verifyPhoneOwnership } from "../utils/firebaseAdmin.js";

const router = express.Router();

// Fields a user is allowed to change through /update-profile.
// Phone and password are deliberately excluded: they have their own flows.
const EDITABLE_FIELDS = [
  "name", "shopName", "address", "city", "state", "gender", "age", "profilePicUrl", "isShopOpen",
];

const toUserResponse = (user) => ({
  _id: user._id, name: user.name, shopName: user.shopName, phone: user.phone,
  address: user.address, city: user.city, state: user.state, gender: user.gender, age: user.age,
  profilePicUrl: user.profilePicUrl, isShopOpen: user.isShopOpen,
});

// Register new user (requires proof of phone OTP verification)
router.post("/register", async (req, res) => {
  try {
    const { name, shopName, phone, address, city, state, gender, age, password, firebaseToken } = req.body;

    if (!phone || !password || password.length < 6) {
      return res.status(400).json({ message: "Phone number and a password of at least 6 characters are required." });
    }

    if (!(await verifyPhoneOwnership(firebaseToken, phone))) {
      return res.status(401).json({ message: "Phone verification failed. Please verify your OTP again." });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "User with this phone number already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name, shopName, phone, address, city, state, gender, age,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({
      message: "✅ User registered successfully",
      user: toUserResponse(newUser),
      token: signToken(newUser._id),
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// Login user (phone + password check)
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    // Same message for unknown phone and wrong password, so the endpoint
    // can't be used to discover which numbers are registered.
    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Invalid phone number or password." });
    }

    res.json({ message: "✅ Login successful", user: toUserResponse(user), token: signToken(user._id) });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// Verify the logged-in user's current password
router.post("/verify-password", requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    res.json({ message: "Password verified successfully." });
  } catch (err) {
    console.error("Password verification error:", err);
    res.status(500).json({ message: "Server error during password verification." });
  }
});

// Update the logged-in user's profile information
router.put("/update-profile", requireAuth, async (req, res) => {
  try {
    const updateData = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "Profile updated successfully.", user: updatedUser });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ message: "Server error during profile update." });
  }
});

// Reset password after phone OTP verification (verified server-side via Firebase)
router.put("/reset-password", async (req, res) => {
  try {
    const { phone, newPassword, firebaseToken } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    if (!(await verifyPhoneOwnership(firebaseToken, phone))) {
      return res.status(401).json({ message: "Phone verification failed. Please verify your OTP again." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await User.findOneAndUpdate(
      { phone },
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User with this phone number not found." });
    }

    res.json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({ message: "Server error during password reset." });
  }
});

export default router;
