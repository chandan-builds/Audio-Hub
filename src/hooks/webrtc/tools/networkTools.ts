export async function fetchTurnCredentials(serverUrl: string): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(`${serverUrl}/api/turn-credentials`);
    if (!res.ok) {
      throw new Error("Failed to fetch TURN credentials");
    }
    const data = await res.json();
    return data.iceServers;
  } catch (err) {
    console.warn("Failed to fetch TURN credentials, using STUN only:", err);
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
  }
}
