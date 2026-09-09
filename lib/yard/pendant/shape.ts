export type PendantSettingsView = {
  ready: boolean;
  oauthReady: boolean;
  accountId: string;
  workerName: string;
  origin: string;
  googleClientId: string;
  allowedSubs: string;
  apiTokenSet: boolean;
  googleClientSecretSet: boolean;
  sessionSecretSet: boolean;
  craneCount: number;
  googleRedirect: string | null;
};
