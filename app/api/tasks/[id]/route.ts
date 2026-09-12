import { NextRequest, NextResponse } from "next/server";
import { dbTasks } from "@/app/lib/db";

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
