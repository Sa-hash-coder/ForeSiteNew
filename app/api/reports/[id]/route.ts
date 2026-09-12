import { NextRequest, NextResponse } from "next/server";
import { dbReports, connectToDatabase } from "@/app/lib/db";
import mongoose from "mongoose";

// MongoDB Models
const UserSubmissionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    location: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        "near_miss",
        "unsafe_condition",
        "unsafe_act",
        "equipment_failure",
        "chemical_exposure",
        "other",
      ],
      default: "other",
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    imageUrl: { type: String, default: null },
    audioUrl: { type: String, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, default: null },
    userEmail: { type: String, default: null },
    department: { type: String, default: null },
    status: {
      type: String,
      enum: [
        "pending_analysis",
        "analysis_complete",
        "under_review",
        "action_assigned",
        "resolved",
        "closed",
      ],
      default: "pending_analysis",
    },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: "MEDIUM" },
    sifProbability: { type: Number, default: 0 },
    precursors: { type: [String], default: [] },
    hazards: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    explanation: { type: String, default: "" },
    rawData: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: false }
);

const UserSubmission =
  mongoose.models.UserSubmission || mongoose.model("UserSubmission", UserSubmissionSchema, "reports");

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Try MongoDB first, fallback to local JSON
    let report = null;

    try {
      await connectToDatabase();
      report = await UserSubmission.findById(id).lean();
      if (report) {
        return NextResponse.json({
          success: true,
          data: {
            _id: report._id,
            title: report.title,
            description: report.description,
            location: report.location,
            category: report.category,
            severity: report.severity,
            imageUrl: report.imageUrl,
            audioUrl: report.audioUrl,
            status: report.status,
            submittedBy: report.submittedBy,
            riskAssessment: {
              riskScore: report.riskScore,
              riskLevel: report.riskLevel,
              sifProbability: report.sifProbability,
              precursors: report.precursors,
              hazards: report.hazards,
              explanation: report.explanation,
            },
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
          },
        });
      }
    } catch (mongoErr) {
      console.warn("MongoDB unavailable, falling back to local JSON store");
    }

    // Fallback to local JSON store
    report = await dbReports.findById(id);

    if (!report) {
      return NextResponse.json(
        { success: false, message: "Report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        _id: report._id,
        title: report.title,
        description: report.description,
        location: report.location,
        category: report.category,
        severity: report.severity,
        imageUrl: report.imageUrl,
        audioUrl: report.audioUrl,
        status: report.status,
        submittedBy: report.submittedBy,
        riskAssessment: {
          riskScore: report.risk_score,
          riskLevel: report.risk_level,
          sifProbability: report.sif_probability,
          precursors: report.precursors,
          hazards: report.hazards,
          explanation: report.explanation,
        },
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error fetching report details:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch report" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, message: "Status update is required" },
        { status: 400 }
      );
    }

    // Try MongoDB first, fallback to local JSON
    let updated = null;

    try {
      await connectToDatabase();
      updated = await UserSubmission.findByIdAndUpdate(
        id,
        { status, updatedAt: new Date() },
        { new: true }
      ).lean();

      if (updated) {
        return NextResponse.json({
          success: true,
          data: updated,
        });
      }
    } catch (mongoErr) {
      console.warn("MongoDB update failed, falling back to local JSON store:", mongoErr);
    }

    // Fallback to local JSON store
    updated = await dbReports.updateById(id, { status });
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating report status:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update report status" },
      { status: 500 }
    );
  }
}
