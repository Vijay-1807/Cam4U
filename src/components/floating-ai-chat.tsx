'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { Send, X } from 'lucide-react';
import { MessageLoading } from '@/components/ui/message-loading';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export function FloatingAIChat() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: 'Hello! I\'m your AI security assistant. Ask me anything about your detections, events, or security system.',
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        // Scroll to bottom when messages change or chat opens
        if (open && scrollRef.current) {
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);
        }
    }, [messages, open]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await apiClient.aiChat(userMessage.content);
            const assistantMessage: Message = {
                role: 'assistant',
                content: response.response,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to get AI response',
                variant: 'destructive',
            });
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        size="lg"
                        className={cn(
                            "h-16 w-16 rounded-full shadow-xl transition-all duration-300 hover:scale-105 p-0 overflow-hidden border-2 border-primary/20",
                            "bg-background hover:bg-muted"
                        )}
                        onClick={() => setOpen(!open)}
                    >
                        <div className="relative h-full w-full bg-white">
                            <Image
                                src="/robot.png"
                                alt="AI Assistant"
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                priority
                            />
                        </div>
                        <span className="sr-only">Toggle AI Chat</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={20}
                    className="w-[380px] h-[600px] p-0 border-0 shadow-2xl rounded-xl overflow-hidden"
                >
                    <Card className="h-full flex flex-col border-0 rounded-none shadow-none">
                        <CardHeader className="bg-muted/30 border-b px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="relative h-10 w-10 rounded-full overflow-hidden bg-background border shadow-sm">
                                        <Image
                                            src="/robot.png"
                                            alt="Bot"
                                            fill
                                            sizes="40px"
                                            className="object-cover"
                                        />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-semibold">Cam4U AI</CardTitle>
                                        <CardDescription className="text-xs flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            Online
                                        </CardDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={() => setOpen(false)}>
                                    <X className="h-4 w-4 opacity-70" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col min-h-0 p-0 relative">
                            <ScrollArea className="flex-1 p-4 h-full">
                                <div className="space-y-4 pb-4">
                                    {messages.map((message, index) => (
                                        <div
                                            key={index}
                                            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                                                }`}
                                        >
                                            {message.role === 'assistant' && (
                                                <div className="flex-shrink-0 mt-1">
                                                    <div className="relative h-8 w-8 rounded-full overflow-hidden bg-muted border shadow-sm">
                                                        <Image
                                                            src="/robot.png"
                                                            alt="Bot"
                                                            fill
                                                            sizes="32px"
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${message.role === 'user'
                                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                                    : 'bg-muted/80 border rounded-bl-none'
                                                    }`}
                                            >
                                                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                                <p className={`text-[10px] mt-1 text-right ${message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                                    }`}>
                                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {loading && (
                                        <div className="flex gap-3 justify-start">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="relative h-8 w-8 rounded-full overflow-hidden bg-muted border">
                                                    <Image
                                                        src="/robot.png"
                                                        alt="Bot"
                                                        fill
                                                        sizes="32px"
                                                        className="object-cover"
                                                    />
                                                </div>
                                            </div>
                                            <div className="bg-muted/50 border rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-2">
                                                <div className="scale-75 -ml-2">
                                                    <MessageLoading />
                                                </div>
                                                <span className="text-xs text-muted-foreground">Thinking...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={scrollRef} />
                                </div>
                            </ScrollArea>

                            <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
                                <div className="flex gap-2">
                                    <Input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        placeholder="Type a message..."
                                        disabled={loading}
                                        className="flex-1 rounded-full px-4 border-muted-foreground/20 focus-visible:ring-offset-0 bg-background shadow-sm"
                                    />
                                    <Button
                                        onClick={handleSend}
                                        disabled={loading || !input.trim()}
                                        size="icon"
                                        className="rounded-full h-10 w-10 shrink-0 shadow-sm"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </PopoverContent>
            </Popover>
        </div>
    );
}
