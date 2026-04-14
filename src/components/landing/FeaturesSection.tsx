import React from "react";
import { cn } from "@/lib/utils";
import {
    ShieldCheck,
    Zap,
    Eye,
    Lock,
    Smartphone,
    Server,
} from "lucide-react";

export function FeaturesSection() {
    const features = [
        {
            title: "Real-time Detection",
            description:
                "Instantly identify objects and anomalies with our millisecond-latency AI engine.",
            icon: <Zap className="w-6 h-6" />,
        },
        {
            title: "Encrypted Storage",
            description:
                "Your data is secured with AES-256 encryption. Only you have the keys.",
            icon: <Lock className="w-6 h-6" />,
        },
        {
            title: "Smart Monitoring",
            description:
                "24/7 autonomous surveillance that learns from your environment to reduce false alarms.",
            icon: <Eye className="w-6 h-6" />,
        },
        {
            title: "Instant Alerts",
            description:
                "Get notified immediately via SMS, Email, or Push Notification when a threat is detected.",
            icon: <ShieldCheck className="w-6 h-6" />,
        },
        {
            title: "Mobile Control",
            description:
                "Control your security grid from anywhere in the world with our dedicated mobile headquarters.",
            icon: <Smartphone className="w-6 h-6" />,
        },
        {
            title: "Edge Processing",
            description:
                "Privacy-first design. AI processing happens locally on your device, not in the cloud.",
            icon: <Server className="w-6 h-6" />,
        },
    ];

    return (
        <section className="py-16 md:py-24 bg-black text-white relative z-20 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="mb-12 md:mb-16 text-center">
                    <h2 className="text-3xl md:text-5xl font-bold mb-4 md:mb-6 tracking-tight">
                        Intelligence Built for <span className="text-gray-500">Protection.</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-base md:text-lg">
                        Everything you need to secure your perimeter, powered by next-generation computer vision.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {features.map((feature, index) => (
                        <FeatureCard key={index} {...feature} index={index} />
                    ))}
                </div>
            </div>
        </section>
    );
}

const FeatureCard = ({
    title,
    description,
    icon,
    index,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    index: number;
}) => {
    return (
        <div
            className={cn(
                "flex flex-col justify-between p-6 md:p-8 rounded-[1.5rem] md:rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 group cursor-default relative overflow-hidden"
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="mb-6 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-colors duration-300 relative z-10">
                {icon}
            </div>

            <div className="relative z-10">
                <h3 className="text-xl font-semibold mb-3 group-hover:translate-x-1 transition-transform duration-300">
                    {title}
                </h3>
                <p className="text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );
};
