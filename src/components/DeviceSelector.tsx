import { useState, useEffect } from "react";
import { X, Mic, Headphones, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DeviceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDevice: (deviceId: string) => Promise<void>;
}

export function DeviceSelector({ isOpen, onClose, onSelectDevice }: DeviceSelectorProps) {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
    } catch (err) {
      console.error("Failed to enumerate devices:", err);
    }
  };

  const handleSelectInput = async (deviceId: string) => {
    setLoading(true);
    try {
      await onSelectDevice(deviceId);
      setSelectedInput(deviceId);
    } catch (err) {
      console.error("Failed to switch device:", err);
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
          >
            <div className="bg-zinc-900/95 backdrop-blur-2xl border border-zinc-800/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-zinc-800/60 flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-100">Audio Settings</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 text-zinc-400" />
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* Microphone */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
                      Microphone
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {audioInputs.length === 0 && (
                      <p className="text-sm text-zinc-600 py-2">No microphones found</p>
                    )}
                    {audioInputs.map((device) => (
                      <button
                        key={device.deviceId}
                        onClick={() => handleSelectInput(device.deviceId)}
                        disabled={loading}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 flex items-center justify-between group",
                          selectedInput === device.deviceId
                            ? "bg-zinc-800/80 text-zinc-100 border border-zinc-700/50"
                            : "bg-zinc-900/60 text-zinc-400 border border-zinc-800/40 hover:bg-zinc-800/50 hover:text-zinc-300"
                        )}
                      >
                        <span className="truncate pr-4">
                          {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                        </span>
                        {selectedInput === device.deviceId && (
                          <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speakers */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
                      Speaker / Headphones
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {audioOutputs.length === 0 && (
                      <p className="text-sm text-zinc-600 py-2">No output devices found</p>
                    )}
                    {audioOutputs.map((device) => (
                      <div
                        key={device.deviceId}
                        className="w-full text-left px-4 py-3 rounded-xl text-sm bg-zinc-900/60 text-zinc-400 border border-zinc-800/40"
                      >
                        <span className="truncate">
                          {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600">
                    Output device selection is managed by your system settings.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-zinc-800/60">
                <Button
                  onClick={onClose}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  Done
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
