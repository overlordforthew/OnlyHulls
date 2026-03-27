"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ProfileChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start conversation automatically
  useEffect(() => {
    if (messages.length === 0) {
      const initialMsg: Message = {
        role: "user",
        content: "Hi! I'm looking for a boat and would love help figuring out what's right for me.",
      };
      sendMessage([initialMsg]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(messagesToSend: Message[]) {
    setStreaming(true);

    // Set messages to include all sent messages + empty assistant placeholder
    setMessages([...messagesToSend, { role: "assistant", content: "" }]);

    const res = await fetch("/api/ai/profile-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messagesToSend,
        conversationId,
      }),
    });

    if (!res.ok || !res.body) {
      setStreaming(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            assistantMessage += parsed.text;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: assistantMessage,
              };
              return updated;
            });
          }
          if (parsed.conversationId) {
            setConversationId(parsed.conversationId);
          }
          if (parsed.profileComplete) {
            setProfileComplete(true);
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    setStreaming(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages.filter(m => m.content), userMessage];
    setInput("");

    await sendMessage(updatedMessages);
  }

  // Strip profile_complete tags from displayed content
  function cleanContent(content: string): string {
    return content
      .replace(/<profile_complete>[\s\S]*?<\/profile_complete>/g, "")
      .trim();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col">
      <div className="border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold">Build Your Buyer Profile</h1>
        <p className="text-sm text-text-secondary">
          Chat with our AI to find your perfect boat match
        </p>
      </div>

      <div className="flex-1 px-4 py-6">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">
                  {cleanContent(msg.content)}
                </p>
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-3">
                <span className="animate-pulse text-sm text-foreground/40">
                  Thinking...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {profileComplete ? (
        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
            <p className="font-semibold text-green-800 dark:text-green-200">
              Your Buyer Profile is Ready!
            </p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-300">
              We&apos;ve created your profile and will start matching you with boats.
            </p>
            <button
              onClick={() => router.push("/matches")}
              className="mt-4 rounded-full bg-primary px-6 py-2 text-white hover:bg-primary-dark"
            >
              View My Matches
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="border-t border-border p-4"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me about your dream boat experience..."
              disabled={streaming}
              className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
