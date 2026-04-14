import { useEffect, useState } from 'react';
import { getToken, onMessage, Unsubscribe } from 'firebase/messaging';
import { messaging } from '../lib/firebase';

const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission>('default');

    useEffect(() => {
        const retrieveToken = async () => {
            try {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {

                    const messagingInstance = await messaging;
                    if (!messagingInstance) {
                        console.log("Messaging not supported or failed to init");
                        return;
                    }

                    const permission = await Notification.requestPermission();
                    setNotificationPermissionStatus(permission);

                    if (permission === 'granted') {
                        const currentToken = await getToken(messagingInstance, {
                            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
                        });
                        if (currentToken) {
                            setToken(currentToken);
                            console.log('FCM Token:', currentToken);
                            // TODO: Send this token to your backend to target this device
                        } else {
                            console.log('No registration token available. Request permission to generate one.');
                        }
                    }
                }
            } catch (error) {
                console.error('An error occurred while retrieving token:', error);
            }
        };

        retrieveToken();
    }, []);

    useEffect(() => {
        let unsubscribe: Unsubscribe | null = null;

        const setupOnMessage = async () => {
            const messagingInstance = await messaging;
            if (!messagingInstance) return;

            unsubscribe = onMessage(messagingInstance, (payload) => {
                console.log('Foreground message received:', payload);
                // Show a valid browser notification even in foreground if desired, or use a toast
                if (Notification.permission === 'granted') {
                    new Notification(payload.notification?.title || 'New Alert', {
                        body: payload.notification?.body || 'You have a new alert',
                        icon: '/alertslogo.png'
                    });
                }
            });
        };

        setupOnMessage();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    return { token, notificationPermissionStatus };
};

export default useFcmToken;
