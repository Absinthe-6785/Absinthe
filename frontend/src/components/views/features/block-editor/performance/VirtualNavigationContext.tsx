import React, { createContext, useContext } from 'react';
import type { VirtualNavigationApi } from './virtualNavigation';

const VirtualNavigationCtx = createContext<VirtualNavigationApi | null>(null);

export function VirtualNavigationProvider({
  value,
  children,
}: {
  value: VirtualNavigationApi;
  children: React.ReactNode;
}) {
  return (
    <VirtualNavigationCtx.Provider value={value}>
      {children}
    </VirtualNavigationCtx.Provider>
  );
}

export function useVirtualNavigation(): VirtualNavigationApi | null {
  return useContext(VirtualNavigationCtx);
}
