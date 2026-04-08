// src/components/room/EmptyRoom.tsx
import { Users, Loader2 } from "lucide-react";

export function EmptyRoom() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center p-8">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-violet-500/10 blur-2xl rounded-full" />
        <div className="h-24 w-24 rounded-full border border-zinc-800/60 bg-[#18181b]/50 flex flex-col items-center justify-center relative shadow-xl backdrop-blur-md">
          <Users className="h-8 w-8 text-zinc-600 mb-2" />
          <Loader2 className="h-4 w-4 text-violet-400 animate-spin absolute bottom-4 right-4" />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-zinc-200 mb-2 text-center text-balance bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
        You're the only one here
      </h3>
      <p className="text-zinc-500 text-sm max-w-sm text-center leading-relaxed">
        Share the room invite link with others so they can join you.
      </p>
    </div>
  );
}
