import { useEffect } from 'react';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const TASK_NAME = 'background-message-sync';

TaskManager.defineTask(TASK_NAME, async () => {
  console.log('Background sync triggered');
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

export function useBackgroundSync() {
  useEffect(() => {
    BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 5, // every 5 minutes
    }).catch(console.error);
  }, []);
}
