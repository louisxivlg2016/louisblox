import { useEffect, useRef, useState } from 'react';
import { sendChatMessage, useChatStore } from '../game/chat';
import { clearInput, requestPlay } from '../game/input';
import { useMultiplayerStore } from '../game/multiplayerStore';
import { useGameStore } from '../game/store';
import chatButtonUrl from '../../assets/ui/chat-button.webp';
import { translate } from '../game/language';

export function ChatPanel() {
  const enabled = useMultiplayerStore((state) => state.enabled);
  const status = useMultiplayerStore((state) => state.status);
  const mode = useGameStore((state) => state.mode);
  const messages = useChatStore((state) => state.messages);
  const open = useChatStore((state) => state.open);
  const setOpen = useChatStore((state) => state.setOpen);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const online = enabled && status === 'online';

  const openChat = () => {
    if (!online) return;
    clearInput();
    setError('');
    setOpen(true);
    useGameStore.getState().setMode('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const closeChat = () => {
    setOpen(false);
    setDraft('');
    setError('');
    window.setTimeout(() => { void requestPlay(); }, 50);
  };
  const submit = () => {
    if (!draft.trim()) return;
    if (!sendChatMessage(draft)) {
      setError(translate('Connexion au salon indisponible. Réessaie dans un instant.', 'Room connection unavailable. Try again in a moment.'));
      return;
    }
    closeChat();
  };

  useEffect(() => {
    if (!online) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== 'Enter' || event.repeat || useChatStore.getState().open || useGameStore.getState().mode !== 'play') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      openChat();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [online]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [open, messages]);

  if (!online) return null;
  return (
    <>
      {mode === 'play' && !open && (
        <button className="chat-toggle" onClick={openChat} aria-label={translate('Ouvrir le chat', 'Open chat')}><img src={chatButtonUrl} alt={translate('Chat · Entrée', 'Chat · Enter')} /></button>
      )}
      {open && (
        <div className="chat-backdrop">
          <section className="chat-panel" role="dialog" aria-label={translate('Chat du salon', 'Room chat')}>
            <header className="chat-header">
              <strong>{translate('Chat du salon', 'Room chat')}</strong>
              <button className="chat-close" onClick={closeChat} aria-label={translate('Fermer le chat', 'Close chat')}>×</button>
            </header>
            <div className="chat-messages" ref={messagesRef} aria-live="polite">
              {messages.length === 0 && <p className="chat-empty">{translate('Écris le premier message aux joueurs du salon.', 'Write the first message to players in the room.')}</p>}
              {messages.map((message) => (
                <p className="chat-message" key={message.messageId}>
                  <time>{new Date(message.sentAt).toLocaleTimeString(translate('fr-FR', 'en-US', 'es-ES'), { hour: '2-digit', minute: '2-digit' })}</time>
                  <strong>{message.name}</strong>
                  <span>{message.text}</span>
                </p>
              ))}
            </div>
            <form className="chat-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeChat();
                    return;
                  }
                  if (event.key !== 'Enter' || event.repeat) return;
                  event.preventDefault();
                  submit();
                }}
                maxLength={200}
                placeholder={translate('Votre message…', 'Your message…')}
                aria-label={translate('Message aux joueurs', 'Message to players')}
                autoFocus
              />
              <button className="chat-send" type="submit" disabled={!draft.trim()}>{translate('Envoyer', 'Send')}</button>
            </form>
            <p className="chat-help">{error || translate('Entrée : envoyer · Échap : fermer', 'Enter: send · Esc: close')}</p>
          </section>
        </div>
      )}
    </>
  );
}
