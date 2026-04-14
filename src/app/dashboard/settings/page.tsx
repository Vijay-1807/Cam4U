"use client";

import { ProfileForm } from "./_components/profile-form";
import { NotificationsForm } from "./_components/notifications-form";
import { DangerZoneForm } from "./_components/danger-zone-form";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account settings, profile, and application preferences.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Profile */}
                <div className="space-y-6">
                    <ProfileForm />
                </div>

                {/* Right Column: Notifications and Danger Zone */}
                <div className="space-y-6">
                    <NotificationsForm />
                    <DangerZoneForm />
                </div>
            </div>
        </div>
    );
}
