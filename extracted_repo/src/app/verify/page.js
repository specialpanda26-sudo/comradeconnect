"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/constants";

// Requires phone auth (SMS OTP) to be enabled in Supabase Auth settings with
// an SMS provider configured (Twilio, MessageBird, or Vonage) — see
// https://supabase.com/docs/guides/auth/phone-login. Until that's set up,
// signInWithOtp below will return an error, which is surfaced to the user.
export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/my-tickets";

  const [step, setStep] = useState("phone"); // "phone" | "code"
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const e164 = `+${normalizePhone(phone)}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
  }

  async function confirmCode(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const e164 = `+${normalizePhone(phone)}`;
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: "sms" });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(redirect);
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-card p-6">
        {step === "phone" ? (
          <form onSubmit={sendCode}>
            <h1 className="text-[20px] font-medium mb-1">Verify your phone</h1>
            <p className="text-[13px] text-secondary mb-5">
              We'll text you a code to find your tickets and let you leave reviews.
            </p>
            <input
              type="tel"
              placeholder="07XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-[14px] mb-4 outline-none"
            />
            {error && <p className="text-[12px] text-accentRed mb-3">{error}</p>}
            <button
              disabled={loading || !phone}
              className="w-full rounded-button bg-ink py-3 text-[14px] font-medium text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={confirmCode}>
            <h1 className="text-[20px] font-medium mb-1">Enter the code</h1>
            <p className="text-[13px] text-secondary mb-5">
              Sent to {phone}.{" "}
              <button type="button" onClick={() => setStep("phone")} className="underline">
                Wrong number?
              </button>
            </p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-[14px] mb-4 outline-none tracking-[4px]"
            />
            {error && <p className="text-[12px] text-accentRed mb-3">{error}</p>}
            <button
              disabled={loading || code.length < 4}
              className="w-full rounded-button bg-ink py-3 text-[14px] font-medium text-white disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
