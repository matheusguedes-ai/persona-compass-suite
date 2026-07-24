import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string;
}

const UserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) { setUser(null); return; }
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const name = (typeof meta.full_name === "string" && meta.full_name) ||
                   (typeof meta.name === "string" && meta.name) ||
                   (data.user.email ?? "Usuário");
      setUser({ id: data.user.id, email: data.user.email ?? null, displayName: String(name) });
    };
    hydrate();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { hydrate(); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): CurrentUser | null {
  return useContext(UserContext);
}