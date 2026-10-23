export interface SquadPortalSettings {
  defaultWatermarkText: string;
  defaultWatermarkOpacity: number;
  antiScreenBlur: boolean;
  requireEmailDefault: boolean;
  requirePasscodeDefault: boolean;
  defaultPasscode: string;
  enforceAdminOnlyUploads: boolean;
  allowGuestsToView: boolean;
  autoExpireDays: number; // 0 = never
  blockPrintingAndSave: boolean;
  showForensicAuditInfo: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PORTAL_SETTINGS: SquadPortalSettings = {
  defaultWatermarkText: 'THE HELPING SQUAD • VIEW ONLY',
  defaultWatermarkOpacity: 0.22,
  antiScreenBlur: true,
  requireEmailDefault: false,
  requirePasscodeDefault: false,
  defaultPasscode: '',
  enforceAdminOnlyUploads: true,
  allowGuestsToView: true,
  autoExpireDays: 0,
  blockPrintingAndSave: true,
  showForensicAuditInfo: true,
};
