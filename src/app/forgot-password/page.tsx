
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MessageLoading } from "@/components/ui/message-loading";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [serverCode, setServerCode] = useState(""); // Stores code (prototype only)
    const [error, setError] = useState("");

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "reset-password", email }),
            });
            const data = await res.json();
            if (data.success) {
                setServerCode(data.code);
                setStep(2);
            } else {
                setError(data.error || "Failed to send reset email");
            }
        } catch (e) {
            console.error(e);
            setError("Failed to send reset email");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (code === serverCode) {
            setStep(3);
        } else {
            setError("Invalid verification code");
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("http://localhost:5000/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password: newPassword }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to reset password");
            }

            router.push("/login?reset=success");
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to reset password");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#FAFAFA] font-sans p-4 text-gray-900">
            <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl max-w-md w-full relative border border-gray-100">
                <Link href="/login" className="absolute top-8 left-8 text-gray-400 hover:text-black transition-colors">
                    <ArrowLeft />
                </Link>

                <div className="mt-8">
                    {error && (
                        <div className="mb-4 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <form onSubmit={handleSendCode}>
                            <h1 className="text-2xl font-semibold mb-2 tracking-tight">Forgot Password?</h1>
                            <p className="text-gray-500 mb-6">Enter your email to reset your password.</p>
                            <input
                                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="Email address"
                                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none mb-6 transition-all placeholder-gray-400"
                            />
                            <button type="submit" disabled={isLoading} className="w-full py-3 rounded-full bg-black text-white font-semibold shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all flex items-center justify-center">
                                {isLoading ? (
                                    <div className="scale-75 brightness-0 invert">
                                        <MessageLoading />
                                    </div>
                                ) : "Send Code"}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyCode}>
                            <h1 className="text-2xl font-semibold mb-2 tracking-tight">Verify Code</h1>
                            <p className="text-gray-500 mb-6">Enter the code sent to {email}</p>
                            <input
                                type="text" required value={code} onChange={e => setCode(e.target.value)}
                                placeholder="123456"
                                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none mb-6 transition-all text-center text-2xl tracking-widest placeholder-gray-300"
                            />
                            <button type="submit" className="w-full py-3 rounded-full bg-black text-white font-semibold shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all">
                                Verify
                            </button>
                            <button type="button" onClick={() => setStep(1)} className="w-full mt-4 text-sm text-gray-500 hover:text-black transition-colors">Change Email</button>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleResetPassword}>
                            <h1 className="text-2xl font-semibold mb-2 tracking-tight">New Password</h1>
                            <p className="text-gray-500 mb-6">Create a strong password.</p>
                            <input
                                type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                placeholder="New Password"
                                className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:border-black focus:ring-1 focus:ring-black outline-none mb-6 transition-all placeholder-gray-400"
                            />
                            <button type="submit" disabled={isLoading} className="w-full py-3 rounded-full bg-black text-white font-semibold shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all flex items-center justify-center">
                                {isLoading ? (
                                    <div className="scale-75 brightness-0 invert">
                                        <MessageLoading />
                                    </div>
                                ) : "Reset Password"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
