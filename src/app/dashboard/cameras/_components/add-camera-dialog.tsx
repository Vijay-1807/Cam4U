"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";
import { MessageLoading } from "@/components/ui/message-loading";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

export function AddCameraDialog({ onCameraAdded }: { onCameraAdded?: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: "",
        location: "",
        type: "ip",
        url: "",
        index: "0"
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name) {
            toast({ title: "Validation Error", description: "Camera Name is required", variant: "destructive" });
            return;
        }

        if (formData.type === "ip" && !formData.url) {
            toast({ title: "Validation Error", description: "Camera URL is required for IP cameras", variant: "destructive" });
            return;
        }

        setLoading(true);

        try {
            await apiClient.addCamera({
                name: formData.name,
                location: formData.location || "Unknown Location",
                type: formData.type,
                url: formData.type === "ip" ? formData.url : `USB Camera ${formData.index}`,
                index: formData.type === "usb" ? parseInt(formData.index, 10) : 0
            });

            toast({
                title: "Camera Added",
                description: `Successfully added ${formData.name}`,
            });

            setOpen(false);
            setFormData({ name: "", location: "", type: "ip", url: "", index: "0" });

            if (onCameraAdded) onCameraAdded();

        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to add camera",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Camera
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New Camera</DialogTitle>
                        <DialogDescription>
                            Connect a new IP camera or local USB device to your monitoring system.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Camera Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g. Lobby Cam"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                placeholder="e.g. Front Entrance"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="type">Connection Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(v) => setFormData({ ...formData, type: v, url: "" })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ip">IP Camera (URL over WiFi/LAN)</SelectItem>
                                    <SelectItem value="usb">USB Camera (Directly Connected)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.type === "ip" ? (
                            <div className="grid gap-2">
                                <Label htmlFor="url">Stream URL</Label>
                                <Input
                                    id="url"
                                    placeholder="e.g. http://192.168.1.50:8080/video"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Enter the URL provided by your IP Camera App or Network NVR.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                <Label htmlFor="index">Device Index</Label>
                                <Select
                                    value={formData.index}
                                    onValueChange={(v) => setFormData({ ...formData, index: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Device Index" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Index 0 (Default Webcam)</SelectItem>
                                        <SelectItem value="1">Index 1 (Second Webcam)</SelectItem>
                                        <SelectItem value="2">Index 2 (Third Webcam)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Select the internal device index assigned to the USB camera by the system.
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="min-w-[120px]">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="scale-75 brightness-0 invert">
                                        <MessageLoading />
                                    </div>
                                    <span>Saving...</span>
                                </div>
                            ) : (
                                "Save Camera"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
