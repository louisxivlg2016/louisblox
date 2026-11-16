import { create } from 'zustand';

export type Language = 'fr' | 'en';

function initialLanguage(): Language {
  try {
    return localStorage.getItem('louisblox-language') === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export const useLanguageStore = create<{ language: Language; setLanguage: (language: Language) => void }>((set) => ({
  language: initialLanguage(),
  setLanguage: (language) => {
    try {
      localStorage.setItem('louisblox-language', language);
    } catch {
    }
    set({ language });
  },
}));

export function translate(french: string, english: string) {
  return useLanguageStore.getState().language === 'fr' ? french : english;
}

const serverMessages: Record<string, string> = {
  'Choose a username between 1 and 24 characters.': 'Choisis un pseudo de 1 à 24 caractères.',
  'This username is already in use. Choose another one.': 'Ce pseudo est déjà utilisé. Choisis-en un autre.',
  'Invalid world': 'Monde invalide',
  'You already belong to a tribe.': 'Tu appartiens déjà à une tribu.',
  'Choose a name for your tribe.': 'Choisis un nom pour ta tribu.',
  'Only the leader can create the tribe home.': 'Seul le chef peut créer la maison de la tribu.',
  'The tribe home already exists. You can teleport to it.': 'La maison de la tribu existe déjà. Tu peux t’y téléporter.',
  'Move once before creating the home.': 'Déplace-toi une première fois avant de créer la maison.',
  'Your tribe home is built. Every member will arrive there.': 'La maison de ta tribu est construite. Tous les membres y arrivent.',
  'The tribe does not have a home yet.': 'La tribu n’a pas encore de maison.',
  'Only the tribe leader can invite players.': 'Seul le chef de la tribu peut inviter.',
  'This player cannot be invited.': 'Ce joueur ne peut pas être invité.',
  'This player is not connected to this room.': 'Ce joueur n’est pas connecté dans ce salon.',
  'This invitation is no longer available.': 'Cette invitation n’est plus disponible.',
  'This tribe no longer exists.': 'Cette tribu n’existe plus.',
  'Invitation declined.': 'Invitation refusée.',
  'You are not a member of any tribe.': 'Tu ne fais partie d’aucune tribu.',
  'The owner banned you from this world. They can readmit you later.': 'Le créateur t’a exclu de ce monde. Il peut te réadmettre ensuite.',
};

export function translateServerMessage(message: string) {
  if (useLanguageStore.getState().language !== 'fr' || !message) return message;
  const direct = serverMessages[message];
  if (direct) return direct;
  const invitation = message.match(/^Invitation sent to (.+)\.$/);
  if (invitation) return `Invitation envoyée à ${invitation[1]}.`;
  const alreadyMember = message.match(/^(.+) already belongs to a tribe\.$/);
  if (alreadyMember) return `${alreadyMember[1]} appartient déjà à une tribu.`;
  const joined = message.match(/^(.+) joined your tribe\.$/);
  if (joined) return `${joined[1]} a rejoint ta tribu.`;
  const joinedTribe = message.match(/^You joined tribe (.+)\.$/);
  if (joinedTribe) return `Tu as rejoint la tribu ${joinedTribe[1]}.`;
  const exit = message.match(/^(.+) found the exit!$/);
  if (exit) return `${exit[1]} a trouvé la sortie !`;
  const offside = message.match(/^Offside by (.+)$/);
  if (offside) return `Hors-jeu de ${offside[1]}`;
  return message;
}

function applyDocumentLanguage(language: Language) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.title = language === 'fr' ? 'Louisblox — Explore. Casse. Construis.' : 'Louisblox — Explore. Break. Build.';
}

useLanguageStore.subscribe((state) => applyDocumentLanguage(state.language));
applyDocumentLanguage(useLanguageStore.getState().language);
