import GlassCard from "./GlassCard";
import { REFERRAL_POINTS_PER_SIGNUP } from "@/lib/constants";

// referral: { code, link, pointsBalance, friendsReferred }
export default function ReferralCard({ referral }) {
  const shareText = encodeURIComponent(
    `Grab your ticket on Mtaa Vibes 🎟️ ${referral.link}`
  );

  return (
    <GlassCard className="p-5 mt-6">
      <p className="text-[13px] text-secondary mb-1">Your points</p>
      <p className="text-[26px] font-medium mb-3">{referral.pointsBalance} pts</p>

      <p className="text-[13px] text-secondary mb-4">
        Earn {REFERRAL_POINTS_PER_SIGNUP} points for every friend who buys a
        ticket with your link. {referral.friendsReferred} friend
        {referral.friendsReferred === 1 ? "" : "s"} referred so far.
      </p>

      <div className="flex items-center justify-between glass rounded-2xl px-4 py-3 mb-3">
        <span className="text-[13px] font-mono truncate">{referral.code}</span>
      </div>

      <a
        href={`https://wa.me/?text=${shareText}`}
        target="_blank"
        rel="noreferrer"
        className="block w-full rounded-button bg-ink py-3 text-center text-[14px] font-medium text-white"
      >
        Share to WhatsApp
      </a>
    </GlassCard>
  );
}
