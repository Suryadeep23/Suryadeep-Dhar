import { SquadPortalSettings, DEFAULT_PORTAL_SETTINGS } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'the_helping_squad_portal_settings';

export const settingsService = {
  getLocalSettings(): SquadPortalSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_PORTAL_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Could not read local settings', e);
    }
    return DEFAULT_PORTAL_SETTINGS;
  },

  saveLocalSettings(settings: SquadPortalSettings) {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Could not save local settings', e);
    }
  },

  async getSettings(): Promise<SquadPortalSettings> {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          const merged = { ...DEFAULT_PORTAL_SETTINGS, ...data.settings };
          this.saveLocalSettings(merged);
          return merged;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch remote settings, using local', e);
    }
    return this.getLocalSettings();
  },

  async updateSettings(
    updates: Partial<SquadPortalSettings>,
    updatedBy?: string
  ): Promise<SquadPortalSettings> {
    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'Squad Admin',
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          this.saveLocalSettings(data.settings);
          return data.settings;
        }
      }
    } catch (e) {
      console.warn('Failed to update remote settings, using local', e);
    }

    const current = this.getLocalSettings();
    const updated = { ...current, ...payload };
    this.saveLocalSettings(updated);
    return updated;
  },

  async resetToDefaults(updatedBy?: string): Promise<SquadPortalSettings> {
    return this.updateSettings(DEFAULT_PORTAL_SETTINGS, updatedBy);
  },
};
