export async function getAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "audioinput");
  } catch (err) {
    console.error("Failed to list internal audio inputs:", err);
    return [];
  }
}

export async function getVideoDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  } catch (err) {
    console.error("Failed to list internal video inputs:", err);
    return [];
  }
}
