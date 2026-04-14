import { MessageLoading } from "@/components/ui/message-loading";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-120px)] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="scale-150">
          <MessageLoading />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading dashboard content...
        </p>
      </div>
    </div>
  );
}
