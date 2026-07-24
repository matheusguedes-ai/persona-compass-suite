import { createContext, useContext, useState, type ReactNode } from "react";

export type UserRole = "admin" | "coach" | "avaliado";

interface RoleContextValue {
  role: UserRole;
  setRole: (r: UserRole) => void;
  displayName: string;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const NAMES: Record<UserRole, string> = {
  admin: "Marina Cardoso",
  coach: "Dr. Ricardo Santos",
  avaliado: "Ana Paula Oliveira",
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("coach");
  return (
    <RoleContext.Provider value={{ role, setRole, displayName: NAMES[role] }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  coach: "Coach",
  avaliado: "Avaliado",
};