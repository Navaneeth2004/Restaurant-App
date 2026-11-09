/** `GET /auth/features`: the features that are OFF for this restaurant, each with the message to show. Anything not listed is on. */
export interface FeatureStatus { disabled: Record<string, string> }
