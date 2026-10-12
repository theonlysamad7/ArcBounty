import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const rawReward = String(formData.get("reward") || "").trim();
    const deadline = String(formData.get("deadline") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const requirements = String(formData.get("requirements") || "").trim();

    const winnerCount = Number(formData.get("winnerCount") || 1);
    const distribution = String(formData.get("distribution") || "equal");

    let percentages: number[] = [];

    try {
      percentages = JSON.parse(String(formData.get("percentages") || "[]"));
    } catch {
      return NextResponse.json(
        { error: "Invalid payout percentages." },
        { status: 400 }
      );
    }

    const rewardNumber = Number(rawReward);

    if (
      !title ||
      !category ||
      !rawReward ||
      !Number.isFinite(rewardNumber) ||
      rewardNumber <= 0 ||
      !deadline ||
      !description
    ) {
      return NextResponse.json(
        { error: "Please provide valid values for all required fields." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(winnerCount) ||
      winnerCount < 1 ||
      winnerCount > 100
    ) {
      return NextResponse.json(
        { error: "Winner count must be between 1 and 100." },
        { status: 400 }
      );
    }

    if (distribution !== "equal" && distribution !== "custom") {
      return NextResponse.json(
        { error: "Invalid reward distribution." },
        { status: 400 }
      );
    }

    if (distribution === "custom") {
      if (
        percentages.length !== winnerCount ||
        percentages.some(
          (value) =>
            !Number.isInteger(value) || value <= 0 || value > 100
        ) ||
        percentages.reduce((sum, value) => sum + value, 0) !== 100
      ) {
        return NextResponse.json(
          {
            error:
              "Custom percentages must be positive whole numbers adding up to 100%.",
          },
          { status: 400 }
        );
      }
    } else {
      percentages = [];
    }

    const bounty = {
      id: `bounty-${crypto.randomUUID()}`,
      category,
      tag: "Open",
      title,
      description,
      reward: `${rawReward} USDC`,
      winners: winnerCount,
      distribution,
      percentages,
      time_label: deadline,
      deadline,
      submissions: "0 submissions",
      creator: "ArcBounty",
      requirements,
      status: "Open",
    };

    const { error } = await supabaseAdmin
      .from("bounties")
      .insert(bounty);

    if (error) {
      console.error("Supabase bounty insert failed:", error.message);
      return NextResponse.json(
        { error: "Unable to save bounty." },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch (error) {
    console.error("Bounty creation error:", error);

    return NextResponse.json(
      { error: "Unable to create bounty." },
      { status: 500 }
    );
  }
}
