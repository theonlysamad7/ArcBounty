import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "data", "submissions.json");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const submissionId = String(formData.get("submissionId") || "").trim();
    const action = String(formData.get("action") || "").trim().toLowerCase();

    if (!submissionId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid submission review request." },
        { status: 400 }
      );
    }

    const file = await fs.readFile(filePath, "utf8");
    const submissions = JSON.parse(file);

    const submissionIndex = submissions.findIndex(
      (submission: { id: string }) => submission.id === submissionId
    );

    if (submissionIndex === -1) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 }
      );
    }

    submissions[submissionIndex].status =
      action === "approve" ? "Approved" : "Rejected";

    submissions[submissionIndex].reviewedAt = new Date().toISOString();

    await fs.writeFile(
      filePath,
      JSON.stringify(submissions, null, 2),
      "utf8"
    );

    return NextResponse.redirect(
      new URL(
        `/bounties/${submissions[submissionIndex].bountyId}/submissions`,
        request.url
      ),
      303
    );
  } catch (error) {
    console.error("Submission review error:", error);

    return NextResponse.json(
      { error: "Unable to review submission." },
      { status: 500 }
    );
  }
}
