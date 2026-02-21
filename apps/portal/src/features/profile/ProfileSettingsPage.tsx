import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AppDefinition, AuthMeResponse, AppId } from "../../shared/auth/types";
import { type ProfileMeResponse, updateCurrentProfile } from "./profileApi";

interface ProfileSettingsPageProps {
  user: AuthMeResponse;
  visibleApps: AppDefinition[];
  profile: ProfileMeResponse | null;
  profileLoadError: string;
  onProfileUpdated: (profile: ProfileMeResponse) => void;
}

interface FormState {
  fullName: string;
  email: string;
  title: string;
  phone: string;
  defaultApp: AppId;
  notificationsEnabled: boolean;
}

export function ProfileSettingsPage({
  user,
  visibleApps,
  profile,
  profileLoadError,
  onProfileUpdated
}: ProfileSettingsPageProps) {
  const appOptions = useMemo(() => {
    const byId = new Map(visibleApps.map((app) => [app.id, app]));
    if (!byId.has("portal")) {
      byId.set("portal", {
        id: "portal",
        label: "Scranton Portal",
        description: "Central launcher and role-aware navigation.",
        launchUrl: "/"
      });
    }

    return Array.from(byId.values());
  }, [visibleApps]);

  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    title: "",
    phone: "",
    defaultApp: "portal",
    notificationsEnabled: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!profile) {
      return;
    }

    const fallbackDefault = appOptions.some((option) => option.id === profile.preferences.defaultApp)
      ? profile.preferences.defaultApp
      : "portal";

    setForm({
      fullName: profile.profile.fullName,
      email: profile.profile.email,
      title: profile.profile.title,
      phone: profile.profile.phone,
      defaultApp: fallbackDefault,
      notificationsEnabled: profile.preferences.notificationsEnabled
    });
  }, [profile, appOptions]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    setSaving(true);
    try {
      const updated = await updateCurrentProfile({
        profile: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          title: form.title.trim(),
          phone: form.phone.trim()
        },
        preferences: {
          defaultApp: form.defaultApp,
          notificationsEnabled: form.notificationsEnabled
        }
      });

      onProfileUpdated(updated);
      setSuccess("Profile and preferences saved.");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save profile settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="portal-settings-section">
      <h2>Profile and Preferences</h2>
      <p>
        Signed in as <strong>{user.userId}</strong>. These settings are stored per user and applied on next
        authenticated navigation.
      </p>

      {profileLoadError ? (
        <p id="profile-loading-error" className="portal-settings-alert portal-settings-alert--error">
          {profileLoadError}
        </p>
      ) : !profile ? (
        <p id="profile-loading-status" className="portal-settings-meta">Loading profile settings...</p>
      ) : (
        <form id="profile-settings-form" onSubmit={submit} noValidate>
          <div className="portal-settings-grid">
            <label htmlFor="profile-full-name">
              Full name
              <input
                id="profile-full-name"
                value={form.fullName}
                onChange={(event) => setForm((previous) => ({ ...previous, fullName: event.target.value }))}
                required
              />
            </label>

            <label htmlFor="profile-email">
              Email
              <input
                id="profile-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                required
              />
            </label>

            <label htmlFor="profile-title">
              Job title
              <input
                id="profile-title"
                value={form.title}
                onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
              />
            </label>

            <label htmlFor="profile-phone">
              Phone
              <input
                id="profile-phone"
                value={form.phone}
                onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
              />
            </label>

            <label htmlFor="profile-default-app">
              Default app after login
              <select
                id="profile-default-app"
                value={form.defaultApp}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, defaultApp: event.target.value as AppId }))
                }
              >
                {appOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="profile-notifications-enabled" className="portal-settings-checkbox">
              <input
                id="profile-notifications-enabled"
                type="checkbox"
                checked={form.notificationsEnabled}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, notificationsEnabled: event.target.checked }))
                }
              />
              Enable notifications by default
            </label>
          </div>

          <div className="portal-settings-actions">
            <button id="save-profile-btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>

          <p id="profile-error" className={`portal-settings-alert portal-settings-alert--error ${error ? "" : "hidden"}`}>
            {error}
          </p>
          <p
            id="profile-success"
            className={`portal-settings-alert portal-settings-alert--success ${success ? "" : "hidden"}`}
          >
            {success}
          </p>
        </form>
      )}
    </section>
  );
}
