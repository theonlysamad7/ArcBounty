import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const filePath = path.join(process.cwd(), "data", "bounties.json");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const reward = String(formData.get("reward") || "").trim();
    const deadline = String(formData.get("deadline") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const requirements = String(formData.get("requirements") || "").trim();
    const winnerCount = Number(formData.get("winnerCount") || 1);
    const distribution = String(formData.get("distribution") || "equal");
    let percentages: number[] = [];

    try {
      percentages = JSON.parse(String(formData.get("percentages") || "[]"));
    } catch {
      return NextResponse.json({ error: "Invalid payout percentages." }, { status: 400 });
    }

    if (!title || !category || !reward || !deadline || !description) {
      return NextResponse.json(
        { error: "Please complete all required fields." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 100) {
      return NextResponse.json({ error: "Winner count must be between 1 and 100." }, { status: 400 });
    }

    if (distribution !== "equal" && distribution !== "custom") {
      return NextResponse.json({ error: "Invalid reward distribution." }, { status: 400 });
    }

    if (distribution === "custom") {
      if (
        percentages.length !== winnerCount ||
        percentages.some((value) => !Number.isInteger(value) || value < 0 || value > 100) ||
        percentages.reduce((sum, value) => sum + value, 0) !== 100 ||
        percentages.some((value) => value === 0)
      ) {
        return NextResponse.json(
          { error: "Custom percentages must be positive whole numbers adding up to 100%." },
          { status: 400 }
        );
      }
    } else {
      percentages = [];
    }

    let bounties = [];

    try {
      const existing = await fs.readFile(filePath, "utf8");
      bounties = JSON.parse(existing);
    } catch {
      bounties = [];
    }

    const bounty = {
      id: `bounty-${Date.now()}`,
      category,
      tag: "Open",
      title,
      description,
      reward: `${reward} USDC`,
      winners: winnerCount,
      distribution,
      percentages,
      time: deadline,
      deadline,
      submissions: "0 submissions",
      creator: "0xYou...0000",
      requirements,
      status: "Open",
      createdAt: new Date().toISOString(),
    };

    bounties.unshift(bounty);

    await fs.mkdir(path.dirname(filePath), { recursive: true });

    await fs.writeFile(
      filePath,
      JSON.stringify(bounties, null, 2),
      "utf8"
    );

    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch (error) {
    console.error("Bounty creation error:", error);

    return NextResponse.json(
      { error: "Unable to create bounty." },
      { status: 500 }
    );
  }
}
