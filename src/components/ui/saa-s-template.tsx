import React from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";

// Inline Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "secondary" | "ghost" | "gradient";
    size?: "default" | "sm" | "lg";
    children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = "default", size = "default", className = "", children, ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

        const variants = {
            default: "bg-white text-black hover:bg-gray-100",
            secondary: "bg-gray-800 text-white hover:bg-gray-700",
            ghost: "hover:bg-gray-800/50 text-white",
            gradient: "bg-gradient-to-b from-white via-white/95 to-white/60 text-black hover:scale-105 active:scale-95"
        };

        const sizes = {
            default: "h-10 px-4 py-2 text-sm",
            sm: "h-10 px-5 text-sm",
            lg: "h-12 px-8 text-base"
        };

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

// Navigation Component
export const Navigation = React.memo(() => {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    return (
        <header className="fixed top-0 w-full z-50 border-b border-gray-800/50 bg-black/80 backdrop-blur-md">
            <nav className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <Link href="/" className="flex items-center mt-1">
                        <img
                            src="/logo.png"
                            alt="Cam4U Logo"
                            className="h-10 md:h-12 w-auto object-contain brightness-0 invert opacity-90 hover:opacity-100 transition-all"
                        />
                    </Link>

                    <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">
                            Features
                        </a>
                        <a href="#technology" className="text-sm text-white/60 hover:text-white transition-colors">
                            Technology
                        </a>
                        <a href="#about" className="text-sm text-white/60 hover:text-white transition-colors">
                            About
                        </a>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <Link href="/login">
                            <Button type="button" variant="ghost" size="sm">
                                Sign in
                            </Button>
                        </Link>
                        <Link href="/register">
                            <Button type="button" variant="default" size="sm">
                                Sign Up
                            </Button>
                        </Link>
                    </div>

                    <button
                        type="button"
                        className="md:hidden text-white"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>

            {mobileMenuOpen && (
                <div className="md:hidden bg-black/95 backdrop-blur-md border-t border-gray-800/50 animate-[slideDown_0.3s_ease-out]">
                    <div className="px-6 py-4 flex flex-col gap-4">
                        <a
                            href="#features"
                            className="text-sm text-white/60 hover:text-white transition-colors py-2"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Features
                        </a>
                        <a
                            href="#technology"
                            className="text-sm text-white/60 hover:text-white transition-colors py-2"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Technology
                        </a>
                        <a
                            href="#about"
                            className="text-sm text-white/60 hover:text-white transition-colors py-2"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            About
                        </a>
                        <div className="flex flex-row gap-4 pt-4 border-t border-gray-800/50">
                            <Link href="/login" className="flex-1">
                                <Button type="button" variant="ghost" size="sm" className="w-full">
                                    Sign in
                                </Button>
                            </Link>
                            <Link href="/register" className="flex-1">
                                <Button type="button" variant="default" size="sm" className="w-full">
                                    Sign Up
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
});

Navigation.displayName = "Navigation";

// Hero Component
export const Hero = React.memo(() => {
    return (
        <section
            className="relative min-h-screen flex flex-col items-center justify-start px-4 md:px-6 pt-32 pb-20 md:pt-40 md:pb-24 bg-black text-white overflow-hidden"
            style={{
                animation: "fadeIn 0.6s ease-out"
            }}
        >



            <h1
                className="text-4xl md:text-5xl lg:text-7xl font-bold text-center max-w-5xl px-4 md:px-6 leading-[1.1] md:leading-tight mb-6"
                style={{
                    background: "linear-gradient(to bottom, #ffffff, #ffffff, rgba(255, 255, 255, 0.6))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    letterSpacing: "-0.04em"
                }}
            >
                Secure Your Space with <br className="hidden md:block" /> Intelligent Vision
            </h1>

            <p className="text-base md:text-lg text-center max-w-2xl px-4 mb-10 text-gray-400">
                Real-time object detection and anomaly recognition powered by advanced AI. <br className="hidden md:block" /> Monitor, analyze, and protect what matters most.
            </p>

            <div className="flex items-center gap-4 relative z-10 mb-16">
                <Link href="/register">
                    <Button
                        type="button"
                        variant="gradient"
                        size="lg"
                        className="rounded-lg flex items-center justify-center"
                        aria-label="Get started"
                    >
                        Get started
                    </Button>
                </Link>
            </div>

            <div className="w-full max-w-7xl relative pb-20">
                <div
                    className="absolute left-1/2 w-[90%] pointer-events-none z-0"
                    style={{
                        top: "-23%",
                        transform: "translateX(-50%)"
                    }}
                    aria-hidden="true"
                >
                    <img
                        src=""
                        alt=""
                        className="w-full h-auto"
                        loading="eager"
                    />
                </div>

                <div className="relative z-10">
                    <img
                        src="https://res.cloudinary.com/dy9xcggyt/image/upload/v1774165989/Screenshot_2026-03-22_132121_d8gkpr.png"
                        alt="Dashboard preview"
                        className="w-full h-auto rounded-lg shadow-2xl"
                        loading="eager"
                    />
                </div>
            </div>
        </section>
    );
});

Hero.displayName = "Hero";

// Main Component Default Export
export default function SaasTemplate() {
    return (
        <div className="min-h-screen bg-black text-white">
            <Navigation />
            <Hero />
        </div>
    );
}
