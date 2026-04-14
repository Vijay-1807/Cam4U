/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBig-bAgIZCeaqvGLLgiig1hwmWy7V1oqA",
    authDomain: "cam4u-ea224.firebaseapp.com",
    projectId: "cam4u-ea224",
    storageBucket: "cam4u-ea224.firebasestorage.app",
    messagingSenderId: "1047327916824",
    appId: "1:1047327916824:web:5677cfa1a08c5af375946d",
    measurementId: "G-YG6GJDWET1"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Customize notification here
    const notificationTitle = payload.notification?.title || 'New Alert';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new alert',
        icon: '/logo.png', // Adjust if you have a specific icon
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
