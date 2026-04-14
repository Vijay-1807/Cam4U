"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

export function NotificationsForm() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [preferences, setPreferences] = useState({
        email: true,
        push: false
    });

    useEffect(() => {
        const fetchPrefs = async () => {
            try {
                const user = await apiClient.getCurrentUser();
                if (user.notificationPrefs) {
                    setPreferences(user.notificationPrefs);
                }
            } catch (error) {
                console.error("Failed to fetch preferences:", error);
            }
        };
        fetchPrefs();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await apiClient.updateCurrentUser({
                notificationPrefs: preferences
            });
            toast({
                title: "Preferences saved",
                description: "Your notification preferences have been updated.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to save preferences",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>
                        Choose how you want to be notified.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start space-x-3 space-y-0">
                        <Checkbox 
                            id="email-notif" 
                            checked={preferences.email} 
                            onCheckedChange={(checked) => setPreferences({...preferences, email: !!checked})}
                        />
                        <div className="space-y-1 leading-none">
                            <Label htmlFor="email-notif">
                                Email Notifications
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Receive alerts and summaries via email.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3 space-y-0">
                        <Checkbox 
                            id="push-notif" 
                            checked={preferences.push}
                            onCheckedChange={(checked) => setPreferences({...preferences, push: !!checked})}
                        />
                        <div className="space-y-1 leading-none">
                            <Label htmlFor="push-notif">
                                Push Notifications
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Get real-time alerts on your mobile device.
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Saving..." : "Save Preferences"}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
