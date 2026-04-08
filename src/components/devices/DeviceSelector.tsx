import { useState, useEffect } from "react";
import { X, Mic, Headphones, Check, Activity } from "lucide-react";
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
            className="fixed inset-0 z-50 bg-[#09090b]/80 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
          >
            <div className="bg-[#18181b]/95 backdrop-blur-3xl border border-zinc-800/80 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden ring-1 ring-white/5">
              {/* Header */}
              <div className="p-6 border-b border-zinc-800/40 flex items-center justify-between bg-zinc-900/20">
                <h2 className="text-xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">Audio Settings</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors group"
                >
                  <X className="h-5 w-5 text-zinc-400 group-hover:text-zinc-200" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Microphone */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-violet-400">
                    <Mic className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-[0.15em]">
                      Microphone
                    </span>
                  </div>
                  <div className="space-y-2">
                    {audioInputs.length === 0 && (
                      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 text-center">
                        <p className="text-sm text-zinc-500">No microphones found</p>
                      </div>
                    )}
                    {audioInputs.map((device) => (
                      <button
                        key={device.deviceId}
                        onClick={() => handleSelectInput(device.deviceId)}
                        disabled={loading}
                        className={cn(
                          "w-full text-left px-4 py-3.5 rounded-2xl text-sm transition-all duration-200 flex items-center justify-between group cursor-pointer",
                          selectedInput === device.deviceId
                            ? "bg-violet-950/30 text-zinc-100 border border-violet-800/50 shadow-sm shadow-violet-900/20"
                            : "bg-zinc-900/40 text-zinc-400 border border-zinc-800/50 hover:bg-zinc-800/60 hover:text-zinc-200 hover:border-zinc-700/50"
                        )}
                      >
                        <div className="flex items-center gap-3 truncate pr-4">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            selectedInput === device.deviceId ? "bg-emerald-400 animate-pulse" : "bg-transparent"
                          )} />
                          <span className="truncate">
                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                          </span>
                        </div>
                        {selectedInput === device.deviceId && (
                          <Check className="h-5 w-5 text-violet-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Subtle input level visualization hint */}
                  <div className="flex items-center gap-2 mt-2 px-2 opacity-50">
                    <Activity className="h-3 w-3 text-emerald-400" />
                    <div className="flex gap-0.5 h-1.5 flex-1">
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="h-full flex-1 bg-zinc-800 rounded-full" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Speakers */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Headphones className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-[0.15em]">
                      Speaker / Headphones
                    </span>
                  </div>
                  <div className="space-y-2">
                    {audioOutputs.length === 0 && (
                      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 text-center">
                        <p className="text-sm text-zinc-500">No output devices found</p>
                      </div>
                    )}
                    {audioOutputs.map((device) => (
                      <div
                        key={device.deviceId}
                        className="w-full text-left px-5 py-3.5 rounded-2xl text-sm bg-zinc-900/30 text-zinc-500 border border-zinc-800/30"
                      >
                        <span className="truncate">
                          {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500/80 px-2 leading-relaxed">
                    Output device selection is currently managed by your operating system settings.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-zinc-800/40 bg-zinc-900/20">
                <Button
                  onClick={onClose}
                  className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-base h-12 rounded-xl transition-all"
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
