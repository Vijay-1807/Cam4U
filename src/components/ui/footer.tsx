import Link from 'next/link'
import {
    Globe,
    Share2,
    MessageCircle,
    Link as LinkIcon,
    Send,
    Feather,
} from 'lucide-react'

const links = [
    {
        title: 'Features',
        href: '#features',
    },
    {
        title: 'Technology',
        href: '#technology',
    },
    {
        title: 'About',
        href: '#about',
    },
    {
        title: 'Login',
        href: '/login',
    },
    {
        title: 'Register',
        href: '/register',
    },
]

export default function FooterSection() {
    return (
        <footer className="py-8 md:py-16 bg-black text-white border-t border-white/10 relative z-10">
            <div className="mx-auto max-w-5xl px-6">
                <Link
                    href="/"
                    aria-label="go home"
                    className="mx-auto block w-fit text-2xl font-bold tracking-tighter mb-10 hover:opacity-80 transition-opacity"
                >
                    Cam4U
                </Link>

                <div className="my-8 flex flex-wrap justify-center gap-8 text-sm font-medium">
                    {links.map((link, index) => (
                        <Link
                            key={index}
                            href={link.href}
                            className="text-gray-400 hover:text-white transition-colors duration-200"
                        >
                            <span>{link.title}</span>
                        </Link>
                    ))}
                </div>

                <div className="my-8 flex flex-wrap justify-center gap-6">
                    <Link
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Share"
                        className="text-gray-500 hover:text-white transition-colors duration-200"
                    >
                        <Share2 className="w-5 h-5" />
                    </Link>
                    <Link
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Message"
                        className="text-gray-500 hover:text-white transition-colors duration-200"
                    >
                        <MessageCircle className="w-5 h-5" />
                    </Link>
                    <Link
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Link"
                        className="text-gray-500 hover:text-white transition-colors duration-200"
                    >
                        <LinkIcon className="w-5 h-5" />
                    </Link>
                    <Link
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Website"
                        className="text-gray-500 hover:text-white transition-colors duration-200"
                    >
                        <Globe className="w-5 h-5" />
                    </Link>
                    <Link
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Send"
                        className="text-gray-500 hover:text-white transition-colors duration-200"
                    >
                        <Send className="w-5 h-5" />
                    </Link>
                    <Link
                        href="#"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Posts"
                        className="text-gray-500 hover:text-white transition-colors duration-200"
                    >
                        <Feather className="w-5 h-5" />
                    </Link>
                </div>

                <span className="text-gray-600 block text-center text-sm">
                    © {new Date().getFullYear()} Cam4U Security Systems. All rights reserved.
                </span>
            </div>
        </footer>
    )
}
