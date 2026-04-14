import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { getAnalytics, Analytics, isSupported as isAnalyticsSupported } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBig-bAgIZCeaqvGLLgiig1hwmWy7V1oqA",
    authDomain: "cam4u-ea224.firebaseapp.com",
    projectId: "cam4u-ea224",
    storageBucket: "cam4u-ea224.firebasestorage.app",
    messagingSenderId: "1047327916824",
    appId: "1:1047327916824:web:5677cfa1a08c5af375946d",
    measurementId: "G-YG6GJDWET1"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let messaging: Promise<Messaging | null>;
let analytics: Promise<Analytics | null>;

if (typeof window !== "undefined") {
    messaging = isSupported().then((supported) => {
        if (supported) {
            return getMessaging(app);
        }
        return null;
    });

    analytics = isAnalyticsSupported().then((supported) => {
        if (supported) {
            return getAnalytics(app);
        }
        return null;
    });
} else {
    messaging = Promise.resolve(null);
    analytics = Promise.resolve(null);
}

export { app, messaging, analytics };
