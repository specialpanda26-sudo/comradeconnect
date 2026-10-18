"use client";

import { useState } from "react";
import StarRating from "./StarRating";

export default function ReviewForm({ ticketId, accessToken, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!rating) {
      setError("Pick a star rating first");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ticketId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't submit review");
      onSubmitted?.(data.review);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl bg-black/[0.03] p-4">
      <p className="text-[13px] font-medium mb-2">How was it?</p>
      <StarRating value={rating} onChange={setRating} size={24} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tell other buyers what to expect (optional)"
        maxLength={500}
        rows={3}
        className="mt-3 w-full rounded-xl border border-black/10 bg-white p-3 text-[13px] outline-none"
      />
      {error && <p className="mt-2 text-[12px] text-accentRed">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-3 w-full rounded-button bg-ink py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit review"}
      </button>
    </div>
  );
}
