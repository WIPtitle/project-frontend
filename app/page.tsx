"use client";

import { useEffect } from 'react';
import TabLayout from "./components/tab-layout";

export default function Home() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js');
        } else {
            console.log('Browser does not support Service Worker');
        }
    }, []);

    return <TabLayout />;
}
