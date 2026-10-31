import { create } from 'zustand';

export type ChatMessage = {
  messageId: string;
  playerId: string;
  name: string;
  text: string;
  sentAt: number;
};

type ChatStore = {
  messages: ChatMessage[];
  open: boolean;
  setOpen: (open: boolean) => void;
  receive: (message: ChatMessage) => void;
  clear: () => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  open: false,
  setOpen: (open) => set({ open }),
  receive: (message) => set((state) => state.messages.some((current) => current.messageId === message.messageId)
    ? state
    : { messages: [...state.messages, message].slice(-60) }),
  clear: () => set({ messages: [], open: false }),
}));

let socket: WebSocket | null = null;

export function setChatSocket(next: WebSocket | null) {
  socket = next;
}

export function clearChat() {
  socket = null;
  useChatStore.getState().clear();
}

export function sendChatMessage(value: string) {
  const text = value.trim().slice(0, 200);
  if (!text || socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify({ type: 'chat', text }));
  return true;
}

export function receiveChatMessage(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (typeof data.messageId !== 'string' || data.messageId.length < 1 || data.messageId.length > 80) return;
  if (typeof data.playerId !== 'string' || data.playerId.length < 1 || data.playerId.length > 80) return;
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 24) return;
  if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 200) return;
  if (typeof data.sentAt !== 'number' || !Number.isFinite(data.sentAt) || data.sentAt <= 0) return;
  useChatStore.getState().receive({
    messageId: data.messageId,
    playerId: data.playerId,
    name: data.name.trim(),
    text: data.text.trim(),
    sentAt: data.sentAt,
  });
}
