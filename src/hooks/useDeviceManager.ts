import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "audiohub_preferred_devices";

interface PreferredDevices {
  audioInputId: string | null;
  videoInputId: string | null;
  audioOutputId: string | null;
}

interface DeviceState {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  preferred: PreferredDevices;
  permissionState: "unknown" | "granted" | "denied" | "prompt";
  isLoading: boolean;
  error: string | null;
}

function loadPreferred(): PreferredDevices {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { audioInputId: null, videoInputId: null, audioOutputId: null };
}

function savePreferred(prefs: PreferredDevices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

/**
 * Centralized device enumeration + preference management.
 * - Persists last-used mic/camera/speaker to localStorage.
 * - Listens for device changes (plug/unplug).
 * - Handles permission state gracefully.
 */
export function useDeviceManager() {
  const [state, setState] = useState<DeviceState>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
    preferred: loadPreferred(),
    permissionState: "unknown",
    isLoading: false,
    error: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const enumerateDevices = useCallback(async () => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!mountedRef.current) return;

      const audioInputs  = devices.filter(d => d.kind === "audioinput");
      const videoInputs  = devices.filter(d => d.kind === "videoinput");
      const audioOutputs = devices.filter(d => d.kind === "audiooutput");

      setState(prev => {
        // Validate preferred devices still exist
        const pref = { ...prev.preferred };
        if (pref.audioInputId && !audioInputs.find(d => d.deviceId === pref.audioInputId)) {
          pref.audioInputId = audioInputs[0]?.deviceId ?? null;
        }
        if (pref.videoInputId && !videoInputs.find(d => d.deviceId === pref.videoInputId)) {
          pref.videoInputId = videoInputs[0]?.deviceId ?? null;
        }
        if (pref.audioOutputId && !audioOutputs.find(d => d.deviceId === pref.audioOutputId)) {
          pref.audioOutputId = audioOutputs[0]?.deviceId ?? null;
        }
        // Set defaults if not set
        if (!pref.audioInputId && audioInputs.length)  pref.audioInputId  = audioInputs[0].deviceId;
        if (!pref.videoInputId && videoInputs.length)  pref.videoInputId  = videoInputs[0].deviceId;
        if (!pref.audioOutputId && audioOutputs.length) pref.audioOutputId = audioOutputs[0].deviceId;

        return { ...prev, audioInputs, videoInputs, audioOutputs, preferred: pref, isLoading: false };
      });
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Failed to enumerate devices";
      setState(prev => ({ ...prev, isLoading: false, error: msg }));
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Stop tracks immediately — we just wanted to trigger the permission prompt
      stream.getTracks().forEach(t => t.stop());
      if (mountedRef.current) {
        setState(prev => ({ ...prev, permissionState: "granted", isLoading: false }));
      }
      await enumerateDevices();
      return true;
    } catch (err) {
      if (mountedRef.current) {
        const denied = err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
        setState(prev => ({
          ...prev,
          permissionState: denied ? "denied" : "prompt",
          isLoading: false,
          error: denied
            ? "Camera and microphone access was denied. Please allow access in your browser settings."
            : "Could not access camera or microphone.",
        }));
      }
      return false;
    }
  }, [enumerateDevices]);

  const setPreferredAudioInput = useCallback((deviceId: string) => {
    setState(prev => {
      const preferred = { ...prev.preferred, audioInputId: deviceId };
      savePreferred(preferred);
      return { ...prev, preferred };
    });
  }, []);

  const setPreferredVideoInput = useCallback((deviceId: string) => {
    setState(prev => {
      const preferred = { ...prev.preferred, videoInputId: deviceId };
      savePreferred(preferred);
      return { ...prev, preferred };
    });
  }, []);

  const setPreferredAudioOutput = useCallback((deviceId: string) => {
    setState(prev => {
      const preferred = { ...prev.preferred, audioOutputId: deviceId };
      savePreferred(preferred);
      return { ...prev, preferred };
    });
  }, []);

  // Initial enumeration (may get limited info without permissions)
  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  // Re-enumerate on device plug/unplug
  useEffect(() => {
    navigator.mediaDevices.addEventListener("devicechange", enumerateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerateDevices);
    };
  }, [enumerateDevices]);

  return {
    ...state,
    enumerateDevices,
    requestPermissions,
    setPreferredAudioInput,
    setPreferredVideoInput,
    setPreferredAudioOutput,
  };
}
