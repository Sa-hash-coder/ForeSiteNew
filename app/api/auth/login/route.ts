import { NextRequest, NextResponse } from "next/server";
import { dbUsers, connectToDatabase } from "@/app/lib/db";
import { verifyPassword, createToken } from "@/app/lib/security";
import mongoose from "mongoose";

// MongoDB User Model
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["admin", "safety_officer", "officer", "worker", "maintenance", "manager", "technician"],
      default: "worker",
    },
    department: {
      type: String,
      default: "Safety Operations",
    },
    badgeId: {
      type: String,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema, "userinfo");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    let user = null;

    // Try MongoDB first
    try {
      await connectToDatabase();
      
      const mongoUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (mongoUser) {
        user = mongoUser.toObject();
        
        // Update lastLogin in MongoDB
        await User.findByIdAndUpdate(mongoUser._id, { lastLogin: new Date() });
        
        console.log("✅ User login from MongoDB:", mongoUser._id);
      }
    } catch (mongoErr) {
      console.warn("MongoDB login failed, falling back to local JSON store:", mongoErr);
    }

    // Fallback to local JSON store if not found in MongoDB
    if (!user) {
      user = await dbUsers.findByEmail(email);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password. Verify credentials." },
        { status: 401 }
      );
    }

    const isMatch = verifyPassword(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password. Verify credentials." },
        { status: 401 }
      );
    }

    const token = createToken({
      _id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      badgeId: user.badgeId,
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          badgeId: user.badgeId,
        },
        token,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Authentication failed" },
      { status: 500 }
    );
  }
}
