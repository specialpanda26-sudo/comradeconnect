"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Organizer verification gate on the dashboard — PAGE F of the build prompt.
// Uploads front/back of a national ID to the private `organizer-ids` Storage
// bucket (see supabase/schema.sql), then upserts an organizer_verifications
// row so an admin can review and flip status to 'approved'.
export default function IdVerificationForm({ organizerId, verification, onSubmitted }) {
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const status = verification?.status ?? null;
  const isPending = status === "pending";
  const isRejected = status === "rejected";

  function validate(file) {
    if (!file) return "Please choose a file.";
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Please upload a JPG, PNG, WEBP, or PDF.";
    }
    if (file.size > MAX_FILE_BYTES) {
      return "File is too large (max 8MB).";
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const frontErr = validate(front);
    if (frontErr) return setError(`ID front: ${frontErr}`);
    const backErr = validate(back);
    if (backErr) return setError(`ID back: ${backErr}`);

    setUploading(true);
    try {
      const frontExt = front.name.split(".").pop();
      const backExt = back.name.split(".").pop();
      const frontPath = `${organizerId}/front.${frontExt}`;
      const backPath = `${organizerId}/back.${backExt}`;

      const [frontUpload, backUpload] = await Promise.all([
        supabase.storage.from("organizer-ids").upload(frontPath, front, {
          upsert: true,
          contentType: front.type,
        }),
        supabase.storage.from("organizer-ids").upload(backPath, back, {
          upsert: true,
          contentType: back.type,
        }),
      ]);

      if (frontUpload.error) throw frontUpload.error;
      if (backUpload.error) throw backUpload.error;

      // Bucket is private, so we store the storage path (not a public URL) —
      // an admin/service-role client generates a signed URL to review it.
      const { data: row, error: dbError } = await supabase
        .from("organizer_verifications")
        .upsert(
          {
            organizer_id: organizerId,
            id_front_url: frontUpload.data.path,
            id_back_url: backUpload.data.path,
            status: "pending",
            reviewed_at: null,
          },
          { onConflict: "organizer_id" }
        )
        .select()
        .single();

      if (dbError) throw dbError;

      setFront(null);
      setBack(null);
      onSubmitted?.(row);
    } catch (err) {
      console.error("ID verification upload failed:", err);
      setError(err.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (isPending) {
    return (
      <p className="text-[12px] text-tertiary">
        Your ID is under review — this usually takes under 24 hours.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {isRejected && (
        <p className="text-[12px] text-red-600">
          Your last submission was rejected. Please re-upload clear photos of both sides.
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-secondary">ID front</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFront(e.target.files?.[0] ?? null)}
          className="text-[12px]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-secondary">ID back</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setBack(e.target.files?.[0] ?? null)}
          className="text-[12px]"
        />
      </label>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={uploading || !front || !back}
        className="rounded-button bg-ink py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Submit for review"}
      </button>
    </form>
  );
}
