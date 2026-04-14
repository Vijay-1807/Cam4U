"use client";

import useFcmToken from "@/hooks/useFcmToken";
import { useEffect, useRef } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function FcmClient() {
    const { token } = useFcmToken();
    const { isAuthenticated } = useAuth();
    const sentTokenRef = useRef<string | null>(null);

    useEffect(() => {
        // Only send if token exists, we are authenticated, and we haven't sent this exact token in this session
        if (token && isAuthenticated && sentTokenRef.current !== token) {
            console.log("Syncing FCM Token to backend...");
            apiClient.updateFcmToken(token)
                .then(() => {
                    console.log("FCM Token synced successfully");
                    sentTokenRef.current = token;
                })
                .catch(err => console.error("Failed to sync FCM token", err));
        }
    }, [token, isAuthenticated]);

    return null;
}
