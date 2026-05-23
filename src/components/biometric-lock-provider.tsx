"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// ─── Types ─────────────────────────────────────────────────────────────────
type LockState = "checking" | "locked" | "unlocked" | "unsupported";

interface BiometricLockContextType {
  lockState: LockState;
  isSupported: boolean;
  isEnabled: boolean;
  isLocked: boolean;
  unlock: () => Promise<boolean>;
  enableLock: () => Promise<boolean>;
  disableLock: () => Promise<void>;
  lock: () => void;
}

// ─── Storage Keys ────────────────────────────────────────────────────────────
const CREDENTIAL_ID_KEY = "xpense_biometric_credential_id";
const USER_ID_KEY = "xpense_biometric_user_id_hint";

// ─── Helper: encode/decode ArrayBuffer ───────────────────────────────────────
function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// ─── Context ────────────────────────────────────────────────────────────────
const BiometricLockContext = createContext<BiometricLockContextType | undefined>(
  undefined
);

export function useBiometricLock() {
  const ctx = useContext(BiometricLockContext);
  if (!ctx) throw new Error("useBiometricLock must be inside BiometricLockProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function BiometricLockProvider({ children }: { children: React.ReactNode }) {
  const [lockState, setLockState] = useState<LockState>("checking");
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  // ── Detect WebAuthn support ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported =
      !!window.PublicKeyCredential &&
      typeof navigator.credentials?.create === "function" &&
      typeof navigator.credentials?.get === "function";

    setIsSupported(supported);

    if (!supported) {
      setLockState("unsupported");
      return;
    }

    // Check if lock is enabled (credential stored)
    const storedCredId = localStorage.getItem(CREDENTIAL_ID_KEY);
    if (storedCredId) {
      setIsEnabled(true);
      setLockState("locked");
    } else {
      setIsEnabled(false);
      setLockState("unlocked");
    }
  }, []);

  // ── Register (Enable Lock) ────────────────────────────────────────────────
  const enableLock = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      // Generate random user ID for this credential (no server round-trip needed)
      const userIdArray = new Uint8Array(16);
      crypto.getRandomValues(userIdArray);

      const challengeArray = new Uint8Array(32);
      crypto.getRandomValues(challengeArray);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challengeArray,
          rp: {
            name: "Xpense",
            id: window.location.hostname,
          },
          user: {
            id: userIdArray,
            name: "xpense-user",
            displayName: "Xpense User",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },  // ES256
            { type: "public-key", alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Device biometrics (Touch ID, Face ID, Windows Hello)
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
          attestation: "none", // Client-side model — we don't verify attestation server-side
        },
      }) as PublicKeyCredential | null;

      if (!credential) return false;

      // Store credential ID in localStorage (the "key" we'll use to authenticate later)
      const credId = bufferToBase64(credential.rawId);
      localStorage.setItem(CREDENTIAL_ID_KEY, credId);
      localStorage.setItem(USER_ID_KEY, bufferToBase64(userIdArray.buffer));

      setIsEnabled(true);
      setLockState("unlocked"); // Stay unlocked after registering
      return true;
    } catch (err: unknown) {
      // User cancelled or device doesn't have biometrics enrolled
      if (err instanceof Error) {
        console.warn("Biometric registration failed:", err.name, err.message);
      }
      return false;
    }
  }, [isSupported]);

  // ── Authenticate (Unlock) ─────────────────────────────────────────────────
  const unlock = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    const storedCredId = localStorage.getItem(CREDENTIAL_ID_KEY);
    if (!storedCredId) {
      // No credential registered — allow through
      setLockState("unlocked");
      return true;
    }

    try {
      const challengeArray = new Uint8Array(32);
      crypto.getRandomValues(challengeArray);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challengeArray,
          rpId: window.location.hostname,
          allowCredentials: [
            {
              id: base64ToBuffer(storedCredId),
              type: "public-key",
              transports: ["internal"], // Device authenticators only
            },
          ],
          userVerification: "required",
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (!assertion) return false;

      // Client-side model: if the browser returned a credential, it means the user
      // successfully authenticated with their biometric — grant access.
      setLockState("unlocked");
      return true;
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.warn("Biometric authentication failed:", err.name, err.message);
      }
      return false;
    }
  }, [isSupported]);

  // ── Disable Lock ──────────────────────────────────────────────────────────
  const disableLock = useCallback(async () => {
    localStorage.removeItem(CREDENTIAL_ID_KEY);
    localStorage.removeItem(USER_ID_KEY);
    setIsEnabled(false);
    setLockState("unlocked");
  }, []);

  // ── Manual Lock ──────────────────────────────────────────────────────────
  const lock = useCallback(() => {
    if (isEnabled) {
      setLockState("locked");
    }
  }, [isEnabled]);

  return (
    <BiometricLockContext.Provider
      value={{
        lockState,
        isSupported,
        isEnabled,
        isLocked: lockState === "locked",
        unlock,
        enableLock,
        disableLock,
        lock,
      }}
    >
      {children}
    </BiometricLockContext.Provider>
  );
}
