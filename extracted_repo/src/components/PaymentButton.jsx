"use client";

import { useState } from "react";
import RippleButton from "./RippleButton";
import ConfettiBurst from "./ConfettiBurst";

const LABELS = {
  "M-PESA": "M-Pesa",
  "CARD-PAYMENT": "Card",
  "BANK-PAYMENT": "Bank",
};

export default function PaymentButton({ amount, method = "M-PESA", onPay, disabled = false }) {
  const [status, setStatus] = useState("idle");
  const [celebrate, setCelebrate] = useState(false);
  const label = LABELS[method] ?? method;

  async function handleClick() {
    if (disabled || status !== "idle") return;
    setStatus("sending");
    try {
      await onPay?.();
      setStatus("sent");
      setCelebrate(true);
      setTimeout(() => {
        setStatus("idle");
        setCelebrate(false);
      }, 2200);
    } catch (err) {
      console.error("Payment failed:", err);
      setStatus("idle");
    }
  }

  const sendingText = method === "M-PESA" ? "Sending STK push…" : "Redirecting to secure checkout…";
  const sentText = method === "M-PESA" ? "You're in — ticket secured" : "✓ Redirecting…";

  return (
    <div className="text-center relative">
      <ConfettiBurst trigger={celebrate} />

      <RippleButton
        onClick={handleClick}
        disabled={disabled || status !== "idle"}
        tone="dark"
        className={[
          "relative w-full overflow-hidden rounded-button py-4 text-[16px] font-medium text-white shadow-soft transition-all duration-300",
          "hover:-translate-y-0.5 hover:shadow-softLg active:scale-[0.97]",
          status === "sent" ? "bg-accentGreen" : "bg-ink",
          disabled ? "opacity-50" : "",
        ].join(" ")}
      >
        {status === "sending" && (
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.25), transparent 30%)",
              animation: "beamSpin 1.2s linear infinite",
            }}
          />
        )}

        <span className="relative flex items-center justify-center gap-2">
          {status === "sending" && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-white animate-pulseDot" />
            </span>
          )}
          {status === "sent" && (
            <span className="inline-block animate-successPop">✓</span>
          )}
          <span>
            {status === "idle" && `Pay KSh ${amount?.toLocaleString?.() ?? amount} with ${label}`}
            {status === "sending" && sendingText}
            {status === "sent" && sentText}
          </span>
        </span>
      </RippleButton>

      {status === "sending" && (
        <p className="mt-2 text-[11px] text-tertiary animate-pulse">
          Confirming your spot on the guest list…
        </p>
      )}
      {status !== "sending" && (
        <p className="mt-2 text-[11px] text-tertiary">Secured by Ogolla Pay</p>
      )}
    </div>
  );
}
