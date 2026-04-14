import { useState } from "react";
import Image from "next/image";
import { Camera } from "@/lib/api";
import { Camera as CameraIcon } from "lucide-react";

export const CameraFeed = ({ camera, fallbackImage, onOffline }: { camera: Camera, fallbackImage?: any, onOffline?: () => void }) => {
    const [error, setError] = useState(false);

    if (camera.type === 'ip' && !error) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={camera.url}
                alt={`Live feed from ${camera.name}`}
                onError={() => {
                    setError(true);
                    if (onOffline) onOffline();
                }}
                className={`w-full h-full object-cover transition-opacity duration-500 group-hover:opacity-100`}
            />
        );
    }

    return fallbackImage ? (
        <Image
            src={fallbackImage.imageUrl}
            alt={`Feed from ${camera.name}`}
            width={600}
            height={400}
            priority={true}
            className={`w-full h-full object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-100 ${camera.status === 'Offline' ? 'grayscale' : ''}`}
        />
    ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
            <CameraIcon className="h-12 w-12 text-muted-foreground" />
        </div>
    );
};
