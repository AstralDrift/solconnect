import React from 'react';
import { useRouter } from 'next/router';
import ChatThreadScreen from '../../src/screens/ChatThreadScreen';

export default function Thread() {
  const router = useRouter();
  const { peerId } = router.query;

  return <ChatThreadScreen peerId={peerId as string} />;
} 