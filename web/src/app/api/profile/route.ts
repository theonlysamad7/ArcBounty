import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = (searchParams.get("wallet") ?? "").trim();

    if (!isAddress(wallet)) {
      return NextResponse.json(
        { error: "A valid wallet address is required." },
        { status: 400 }
      );
    }

    const { data: bounties, error: bountyError } = await supabaseAdmin
      .from("bounties")
      .select("*")
      .ilike("creator", wallet)
      .order("created_at", { ascending: false });

    if (bountyError) {
      console.error("Profile bounty query failed:", bountyError.message);
      return NextResponse.json(
        { error: "Unable to load your created bounties." },
        { status: 500 }
      );
    }

    const { data: submissions, error: submissionError } =
      await supabaseAdmin
        .from("submissions")
        .select(
          "id, bounty_id, bounty_title, title, description, proof, reward, status, submitted_at, wallet_address, onchain_submission_id"
        )
        .ilike("wallet_address", wallet)
        .order("submitted_at", { ascending: false });

    if (submissionError) {
      console.error(
        "Profile submission query failed:",
        submissionError.message
      );
      return NextResponse.json(
        { error: "Unable to load your submissions." },
        { status: 500 }
      );
    }

    const bountyIds = (bounties ?? []).map((bounty) => String(bounty.id));
    const bountySubmissionCounts: Record<string, number> = {};

    for (const id of bountyIds) {
      bountySubmissionCounts[id] = 0;
    }

    if (bountyIds.length > 0) {
      const { data: bountySubmissions, error: countError } =
        await supabaseAdmin
          .from("submissions")
          .select("bounty_id")
          .in("bounty_id", bountyIds);

      if (countError) {
        console.error(
          "Profile submission count query failed:",
          countError.message
        );
        return NextResponse.json(
          { error: "Unable to load bounty submission counts." },
          { status: 500 }
        );
      }

      for (const item of bountySubmissions ?? []) {
        const id = String(item.bounty_id);
        bountySubmissionCounts[id] =
          (bountySubmissionCounts[id] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      bounties: bounties ?? [],
      submissions: submissions ?? [],
      bountySubmissionCounts,
    });
  } catch (error) {
    console.error("Profile API failed:", error);

    return NextResponse.json(
      { error: "Unable to load profile data." },
      { status: 500 }
    );
  }
}
