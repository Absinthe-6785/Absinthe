import { useSyncExternalStore } from 'react';
import { getNoteBreadcrumb, subscribeNoteBreadcrumb } from '../lib/noteBreadcrumb';

export function useNoteBreadcrumb() {
  return useSyncExternalStore(
    subscribeNoteBreadcrumb,
    getNoteBreadcrumb,
    getNoteBreadcrumb,
  );
}
