import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api";
import { getCurrentContext } from "@/lib/services/context";
import { setSourceToggle } from "@/lib/services/source-toggles";

const Body = z.object({ id: z.literal("govmap"), enabled: z.boolean() });

export const PATCH = apiHandler(async (req) => {
  const { id, enabled } = Body.parse(await req.json());
  const { accountId } = await getCurrentContext();
  const toggles = await setSourceToggle(accountId, id, enabled);
  return NextResponse.json({ ok: true, toggles });
});
