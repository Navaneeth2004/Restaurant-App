/** Limit values by key (`max_devices`, …); a missing key or null means unlimited. */
export type Limits = Record<string, number | null | undefined>;

export interface PlanInfo { slug: string; name: string; description: string; limits: Limits; features_off: number }

/** `GET /auth/subscription` (admin): this restaurant's own plan and the plans it could choose. */
export interface SubscriptionInfo {
  plan: { slug: string; name: string; description: string };
  /** Only trial plans have an end date; null otherwise. */
  trial_ends_at: string | null;
  enforce_trial: boolean;
  limits: Limits;
  plans: PlanInfo[];
}