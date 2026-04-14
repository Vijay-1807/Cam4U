
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { MessageLoading } from "@/components/ui/message-loading";

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [error, setError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            await login(formData.email, formData.password);
            router.push("/dashboard");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Invalid email or password");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex bg-black font-sans text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 h-full overflow-y-auto flex flex-col justify-center px-8 lg:px-24 xl:px-32 py-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] relative z-10">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="mb-10"
                >
                    <Link href="/" className="inline-block px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 text-sm font-medium text-white/80 mb-8 transition-colors">
                        ← Back to Cam4U
                    </Link>
                    <h1 className="text-5xl font-bold mb-2 tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Welcome back</h1>
                    <p className="text-gray-400">Please enter your details to sign in.</p>
                </motion.div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="space-y-2"
                    >
                        <label className="text-sm font-medium text-gray-300 block">Email</label>
                        <input
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="jane@example.com"
                            className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all placeholder-gray-600 text-white"
                        />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="space-y-2"
                    >
                        <label className="text-sm font-medium text-gray-300 block">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all placeholder-gray-600 text-white pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <div className="flex justify-end pt-1">
                            <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-white transition-colors">
                                Forgot Password?
                            </Link>
                        </div>
                    </motion.div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm flex items-center gap-2 border border-red-500/20">
                            <X size={16} /> {error}
                        </div>
                    )}

                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 rounded-full bg-white text-black font-semibold text-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-white/5"
                    >
                        {isLoading ? (
                            <div className="scale-75 brightness-0">
                                <MessageLoading />
                            </div>
                        ) : "Sign in"}
                    </motion.button>
                </form>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-8 text-center text-sm text-gray-500"
                >
                    Don't have an account?{" "}
                    <Link href="/register" className="text-white font-semibold underline decoration-1 underline-offset-4 hover:text-gray-300">
                        Sign up
                    </Link>
                </motion.div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:block w-1/2 p-8 h-full relative z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="h-full w-full rounded-[2rem] overflow-hidden relative bg-zinc-900 border border-white/10 shadow-2xl"
                >
                    <video
                        src="/0310.mp4"
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="h-full w-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>

                    {/* Decorative Elements - Monochrome */}
                    {/* <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="absolute top-10 left-10 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl max-w-xs"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-white text-xs font-medium tracking-wide">SYSTEM ACTIVE</span>
                        </div>
                        <div className="text-gray-300 text-xs font-mono leading-relaxed">
                            &gt; Anomaly detection active...<br />
                            &gt; Grid reliability 99.9%<br />
                            &gt; Encryption secure.
                        </div>
                    </motion.div> */}

                    <div className="absolute bottom-10 left-10 text-white max-w-md">
                        <h2 className="text-3xl font-bold mb-4">Secure & Smart</h2>
                        <p className="opacity-70 leading-relaxed text-gray-300">
                            Advanced object detection and anomaly recognition for your safety.
                            Experience the future of surveillance.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );

}
