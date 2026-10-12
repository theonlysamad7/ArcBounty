import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "data", "submissions.json");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const bountyId = String(formData.get("bountyId") || "");
    const bountyTitle = String(formData.get("bountyTitle") || "");
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const proof = String(formData.get("proof") || "").trim();
    const reward = String(formData.get("reward") || "");

    if (!bountyId || !bountyTitle || !title || !description || !proof) {
      return NextResponse.json(
        { error: "Please complete all required fields." },
        { status: 400 }
      );
    }

    let submissions = [];

    try {
      const existing = await fs.readFile(filePath, "utf8");
      submissions = JSON.parse(existing);
    } catch {
      submissions = [];
    }

    const submission = {
      id: `${Date.now()}`,
      bountyId,
      bountyTitle,
      title,
      description,
      proof,
      reward,
      status: "Pending Review",
      submittedAt: new Date().toISOString(),
    };

    submissions.unshift(submission);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify(submissions, null, 2),
      "utf8"
    );

    return NextResponse.redirect(
      new URL("/submissions", request.url),
      303
    );
  } catch (error) {
    console.error("Submission error:", error);

    return NextResponse.json(
      { error: "Unable to save submission." },
      { status: 500 }
    );
  }
}
