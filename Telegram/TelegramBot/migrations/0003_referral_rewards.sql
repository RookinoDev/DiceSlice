-- Referral tracking existed (migrations/0001) but paid out nothing (see the old "Phase 3, gated
-- on a future economy proposal" comments in d1.mjs/worker.mjs). rewarded_at closes that gap:
-- NULL until the referrer's reward is granted, then set once - the UPDATE...WHERE rewarded_at IS
-- NULL in d1.mjs's rewardReferrerIfDue() is what makes granting exactly-once safe under retries.
ALTER TABLE referrals ADD COLUMN rewarded_at INTEGER;
