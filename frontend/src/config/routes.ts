export const ROUTES = {
  root: '/root',
  pair: '/pair',
  kioskPrefix: '/kiosk',
} as const;

export const kioskPath = (token: string): string => `${ROUTES.kioskPrefix}/${token}`;
