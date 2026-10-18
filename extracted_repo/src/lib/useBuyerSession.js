"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Real phone-OTP session, replacing the old `localStorage.getItem("buyerPhone")`
// placeholder. Buyers verify their phone via /verify (Supabase phone auth,
// SMS OTP), which creates a normal Supabase session — session.user.phone is
// then the source of truth everywhere a buyer's identity matters (my-tickets,
// leaving a review, etc), instead of a free-text field anyone could fill in.
export function useBuyerSession() {
  const [session, setSession] = useState(undefined); // undefined = not loaded yet, null = no session

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  return {
    loading: session === undefined,
    phone: session?.user?.phone ? `+${session.user.phone}` : null,
    accessToken: session?.access_token ?? null,
    signOut: () => supabase.auth.signOut(),
  };
}
