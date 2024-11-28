"use client";

import { useEffect } from 'react';
import TabLayout from "./components/tab-layout";

export default function Home() {
    // use #unsafely-treat-insecure-origin-as-secure in browser to access page
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js');
        } else {
            console.log('Browser does not support Service Worker');
        }
    }, []);

    return <TabLayout />;
}
