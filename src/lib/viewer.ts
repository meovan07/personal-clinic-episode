import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Who is looking: the signed-in user (if any) and whether they are a member. Cached per request.
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isMember: false };
  const { data } = await supabase.from("members").select("user_id").eq("user_id", user.id).maybeSingle();
  return { user, isMember: !!data };
});
