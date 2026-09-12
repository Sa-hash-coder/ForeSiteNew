import { NextRequest, NextResponse } from "next/server";
import { dbTasks, dbReports, dbAlerts } from "@/app/lib/db";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const {
      status,
      clearanceNote,
      assignedCrew,
      severity,
      title,
      description,
      lotoRequired,
    } = body;

    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (clearanceNote !== undefined) updates.clearanceNote = clearanceNote;
    if (assignedCrew !== undefined) updates.assignedCrew = assignedCrew;
    if (severity !== undefined) updates.severity = severity;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (lotoRequired !== undefined) updates.lotoRequired = lotoRequired;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "No update fields provided" },
        { status: 400 }
      );
    }

    const updated = await dbTasks.update(id, updates);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Task not found" },
        { status: 404 }
      );
    }

    // When task is verified / completed, resolve corresponding hazard report & clear alerts
    if (updates.status === "officer_verified" || updates.status === "completed") {
      if (updated.reportId) {
        try {
          await dbReports.updateById(updated.reportId, { status: "resolved" });
          await dbAlerts.acknowledgeByReportId(updated.reportId, "Officer & Maintenance Sign-off");
        } catch (linkErr) {
          console.warn("[API Tasks] Could not auto-resolve linked report or alert:", linkErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update task" },
      { status: 500 }
    );
  }
}
