import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import LoginScreen from '../src/screens/LoginScreen';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page by default
    router.replace('/login');
  }, [router]);

  return null; // This page will redirect, so no need to render anything
}
