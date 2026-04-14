
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import axios from "axios";
import { MessageLoading } from "@/components/ui/message-loading";

export default function VerifyEmailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get("email");

    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isResending, setIsResending] = useState(false);

    // Handle input change
    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return; // Only allow 1 char
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Auto focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`);
            nextInput?.focus();
        }
    };

    // Handle backspace
    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            const prevInput = document.getElementById(`code-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleDisplayCode = () => {
        // Debug helper for prototype
        const pending = localStorage.getItem("pendingRegistration");
        if (pending) {
            try {
                const { verificationCode } = JSON.parse(pending);
                console.log("DEBUG CODE:", verificationCode);
            } catch (e) { }
        }
    }

    useEffect(() => {
        handleDisplayCode();
    }, [])

    const handleVerify = async () => {
        const fullCode = code.join("");
        if (fullCode.length !== 6) {
            setError("Please enter the 6-digit code");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            // 1. Get stored data
            const pendingStr = localStorage.getItem("pendingRegistration");
            if (!pendingStr) {
                throw new Error("No pending registration found. Please register again.");
            }

            const { userData, verificationCode } = JSON.parse(pendingStr);

            // 2. Verify Code (Client-side match for this implementation, handled by API in full backend)
            if (fullCode !== verificationCode) {
                throw new Error("Invalid verification code. Please try again.");
            }

            // 3. Register User on Backend
            // Call the proxy route which calls Python backend
            const registerResponse = await fetch("/api/proxy-register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData),
            });

            if (!registerResponse.ok) {
                const errData = await registerResponse.json();
                throw new Error(errData.error || "Registration failed");
            }

            // 4. Success handling
            setSuccess(true);

            // 5. Send Welcome Email
            await fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "welcome",
                    email: userData.email,
                    name: userData.firstName
                }),
            });

            // Clear storage
            localStorage.removeItem("pendingRegistration");

            // Redirect after delay
            setTimeout(() => {
                router.push("/login?verified=true");
            }, 2000);

        } catch (err: any) {
            setError(err.message || "Verification failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (!email) {
            setError("Missing email address. Please go back and register again.");
            return;
        }

        setIsResending(true);
        setError("");

        try {
            const pendingStr = localStorage.getItem("pendingRegistration");
            if (!pendingStr) {
                throw new Error("No pending registration found. Please register again.");
            }

            const pending = JSON.parse(pendingStr);
            const userData = pending.userData;

            const resendResponse = await fetch("/api/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "verification",
                    email: userData.email,
                    name: `${userData.firstName} ${userData.lastName}`,
                }),
            });

            const resendData = await resendResponse.json();
            if (!resendResponse.ok || !resendData.success) {
                throw new Error(resendData.error || "Failed to resend verification email");
            }

            // Update stored verification code with the new one
            localStorage.setItem(
                "pendingRegistration",
                JSON.stringify({
                    userData,
                    verificationCode: resendData.code,
                })
            );

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to resend verification email");
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#FAFAFA] font-sans p-4 text-gray-900">
            <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl max-w-lg w-full text-center relative overflow-hidden border border-gray-100">
                {success ? (
                    <div className="animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShieldCheck className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Verified!</h2>
                        <p className="text-gray-500 mb-8">Redirecting you to login...</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold mb-2 tracking-tight">Check your email</h1>
                            <p className="text-gray-500">
                                We sent a verification code to <span className="font-semibold text-gray-900">{email}</span>
                            </p>
                        </div>

                        <div className="flex justify-center gap-2 mb-8">
                            {code.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`code-${index}`}
                                    type="text"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-14 rounded-xl border border-gray-200 bg-white text-center text-2xl font-bold focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder-gray-300"
                                />
                            ))}
                        </div>

                        {error && (
                            <div className="p-3 mb-6 rounded-lg bg-red-50 text-red-500 text-sm border border-red-100">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleVerify}
                            disabled={isLoading}
                            className="w-full py-4 rounded-full bg-black text-white font-semibold text-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                        >
                            {isLoading ? (
                                <div className="scale-75 brightness-0 invert">
                                    <MessageLoading />
                                </div>
                            ) : "Verify Email"}
                        </button>

                        <div className="mt-8 text-sm text-gray-500">
                            Didn't receive the email?{" "}
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={isResending}
                                className="text-black font-semibold underline decoration-1 underline-offset-4 hover:text-gray-700 disabled:text-gray-400"
                            >
                                {isResending ? "Resending..." : "Click to resend"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
