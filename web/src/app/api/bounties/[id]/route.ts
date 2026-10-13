import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const id = decodeURIComponent(
      new URL(request.url).pathname.split("/").pop() ?? ""
    );

    if (!id || id.includes("/")) {
      return NextResponse.json(
        { error: "Invalid bounty ID." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("bounties")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Bounty lookup failed:", error.message);

      return NextResponse.json(
        { error: "Unable to retrieve this bounty." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "This bounty is not saved in the marketplace." },
        { status: 404 }
      );
    }

    return NextResponse.json({ bounty: data });
  } catch (error) {
    console.error("Bounty lookup API failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve this bounty." },
      { status: 500 }
    );
  }
}
