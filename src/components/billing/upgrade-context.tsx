"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { UpgradeModal } from "./upgrade-modal";

interface UpgradeCtx {
  openUpgrade: (reason?: string) => void;
  closeUpgrade: () => void;
}

const Ctx = createContext<UpgradeCtx>({
  openUpgrade: () => {},
  closeUpgrade: () => {},
});

export function useUpgrade() {
  return useContext(Ctx);
}

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  const openUpgrade = useCallback((r?: string) => {
    setReason(r);
    setOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openUpgrade, closeUpgrade }}>
      {children}
      <UpgradeModal open={open} onClose={closeUpgrade} reason={reason} />
    </Ctx.Provider>
  );
}
