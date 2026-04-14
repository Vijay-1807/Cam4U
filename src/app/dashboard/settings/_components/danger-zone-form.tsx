"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { MessageLoading } from "@/components/ui/message-loading";
import { useState } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function DangerZoneForm() {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleClearEvents = async () => {
        if (!confirm("Are you sure you want to permanently delete ALL event history? This action cannot be undone.")) {
            return;
        }

        setLoading(true);
        try {
            const response = await apiClient.clearAllEvents();
            toast({
                title: "Data Cleared",
                description: response.message,
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to clear data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-destructive/50 shadow-md">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Danger Zone
                </CardTitle>
                <CardDescription>
                    Irreversible and destructive actions. Proceed with caution.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border rounded-lg bg-destructive/5 border-destructive/20">
                    <div className="space-y-1">
                        <p className="font-medium text-sm text-destructive">Delete All Data</p>
                        <p className="text-xs text-muted-foreground">
                            Permanently delete all events, captured media, and anomaly logs.
                        </p>
                    </div>
                    <Button 
                        variant="destructive" 
                        className="w-full sm:w-auto flex items-center gap-2 font-bold shadow-sm hover:shadow-destructive/50"
                        onClick={handleClearEvents}
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="scale-75 brightness-0 invert">
                                <MessageLoading />
                            </div>
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                        Clear Data
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
