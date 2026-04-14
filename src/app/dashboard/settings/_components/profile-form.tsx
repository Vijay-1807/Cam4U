"use client";

import { Button as UIButton } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { apiClient, User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageLoading } from "@/components/ui/message-loading";



export function ProfileForm() {
    const { toast } = useToast();
    const { updateUser: refreshGlobalUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [initialFetching, setInitialFetching] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [user, setUser] = useState<Partial<User>>({
        firstName: "",
        lastName: "",
        email: "",
        avatarUrl: ""
    });

    useEffect(() => {
        const fetchUser = async () => {
            try {
                setInitialFetching(true);
                const userData = await apiClient.getCurrentUser();
                setUser(userData);
            } catch (error) {
                console.error("Failed to fetch user:", error);
            } finally {
                setInitialFetching(false);
            }
        };
        fetchUser();
    }, []);

    if (initialFetching) {
        return (
            <Card className="flex items-center justify-center p-12">
                <MessageLoading />
            </Card>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await apiClient.updateCurrentUser(user);
            refreshGlobalUser(user);
            toast({
                title: "Profile updated",
                description: "Your profile information has been updated successfully.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to update profile",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const response = await apiClient.uploadMedia(file, 'image');
            const updatedUser = { ...user, avatarUrl: response.url };
            setUser(updatedUser);
            refreshGlobalUser(updatedUser);
            toast({
                title: "Avatar uploaded",
                description: "Your custom profile picture has been updated.",
            });
        } catch (error: any) {
            toast({
                title: "Upload failed",
                description: error.message || "Could not upload image",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    const removeAvatar = () => {
        const updatedUser = { ...user, avatarUrl: "" };
        setUser(updatedUser);
        refreshGlobalUser(updatedUser);
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>
                        Manage your personal information and profile picture.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar Selection section */}
                    <div className="space-y-4">
                        <Label>Profile Picture</Label>
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="relative group">
                                <Avatar className="h-24 w-24 border-2 border-primary/20 transition-all group-hover:border-primary/50">
                                    <AvatarImage src={user.avatarUrl} alt="Avatar" />
                                    <AvatarFallback className="text-xl">
                                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <div className="scale-50">
                                            <MessageLoading />
                                        </div>
                                    ) : <Camera className="h-6 w-6" />}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>

                            <div className="flex-1 space-y-3 w-full">
                                <p className="text-sm font-medium text-muted-foreground">Upload a custom profile picture</p>
                                <div className="flex items-center gap-4">
                                    <UIButton
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-10 border-dashed border-2 hover:border-primary transition-all"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload Image
                                    </UIButton>
                                    
                                    {user.avatarUrl && (
                                        <UIButton
                                            type="button"
                                            variant="ghost"
                                            onClick={removeAvatar}
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-10 px-4"
                                        >
                                            Remove
                                        </UIButton>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First name</Label>
                            <Input
                                id="firstName"
                                value={user.firstName}
                                onChange={(e) => setUser({ ...user, firstName: e.target.value })}
                                placeholder="First name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last name</Label>
                            <Input
                                id="lastName"
                                value={user.lastName}
                                onChange={(e) => setUser({ ...user, lastName: e.target.value })}
                                placeholder="Last name"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={user.email}
                            onChange={(e) => setUser({ ...user, email: e.target.value })}
                            placeholder="Email"
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center border-t py-4">
                    <p className="text-xs text-muted-foreground">Make sure to save your changes.</p>
                    <UIButton type="submit" disabled={loading} className="min-w-[120px]">
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="scale-50 brightness-0 invert">
                                    <MessageLoading />
                                </div>
                                <span>Saving...</span>
                            </div>
                        ) : "Save Changes"}
                    </UIButton>
                </CardFooter>
            </form>
        </Card>
    );
}
