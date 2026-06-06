import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  checkIsStaff,
  displayNameFromUser,
  fetchUserRoles,
  initialsFromName,
  pickPrimaryRole,
  roleLabel,
  type AppRole,
} from "@/lib/auth";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  roles: AppRole[];
  displayName: string;
  initials: string;
  roleDisplay: string;
  isStaff: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadStaffProfile(user: User) {
  const [roles, isStaff] = await Promise.all([
    fetchUserRoles(user.id),
    checkIsStaff(user.id),
  ]);
  const role = pickPrimaryRole(roles);
  const displayName = displayNameFromUser(user);
  return {
    roles,
    role,
    isStaff,
    displayName,
    initials: initialsFromName(displayName),
    roleDisplay: role ? roleLabel(role) : "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [initials, setInitials] = useState("؟؟");
  const [roleDisplay, setRoleDisplay] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  const initializedRef = useRef(false);
  const profileRequestRef = useRef(0);

  const applyProfile = useCallback(
    (nextUser: User | null, profile: Awaited<ReturnType<typeof loadStaffProfile>> | null) => {
      if (!nextUser || !profile) {
        setRoles([]);
        setRole(null);
        setDisplayName("");
        setInitials("؟؟");
        setRoleDisplay("");
        setIsStaff(false);
        return;
      }
      setRoles(profile.roles);
      setRole(profile.role);
      setDisplayName(profile.displayName);
      setInitials(profile.initials);
      setRoleDisplay(profile.roleDisplay);
      setIsStaff(profile.isStaff);
    },
    [],
  );

  const loadProfileForUser = useCallback(
    async (nextUser: User | null) => {
      const req = ++profileRequestRef.current;

      if (!nextUser) {
        if (req === profileRequestRef.current) applyProfile(null, null);
        return;
      }

      try {
        const profile = await loadStaffProfile(nextUser);
        if (req === profileRequestRef.current) applyProfile(nextUser, profile);
      } catch (err) {
        if (import.meta.env.DEV) console.error("[Auth] profile load failed:", err);
        if (req === profileRequestRef.current) applyProfile(nextUser, null);
      }
    },
    [applyProfile],
  );

  const refreshProfile = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    setUser(data.user);
    await loadProfileForUser(data.user);
  }, [loadProfileForUser]);

  useEffect(() => {
    let mounted = true;

    const finishInitialLoad = () => {
      if (mounted && !initializedRef.current) {
        initializedRef.current = true;
        setLoading(false);
      }
    };

    // Safety net — never leave the UI on a spinner forever.
    const timeout = setTimeout(() => {
      if (import.meta.env.DEV) console.error("[Auth] initial load timed out");
      finishInitialLoad();
    }, 8000);

    // Supabase deadlock fix: onAuthStateChange callback must stay synchronous.
    // Never await inside it — defer profile loading separately.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      void loadProfileForUser(nextSession?.user ?? null).finally(finishInitialLoad);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [loadProfileForUser]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      role,
      roles,
      displayName,
      initials,
      roleDisplay,
      isStaff,
      loading,
      signOut,
      refreshProfile,
    }),
    [
      session,
      user,
      role,
      roles,
      displayName,
      initials,
      roleDisplay,
      isStaff,
      loading,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
