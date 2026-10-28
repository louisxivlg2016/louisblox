import musicUrl from '../../assets/Morning_At_The_Edge_Of_The_Map.mp3';

let music: HTMLAudioElement | null = null;

export function startMusic() {
  if (!music) {
    music = new Audio(musicUrl);
    music.id = 'background-music';
    music.loop = true;
    music.volume = 0.28;
    music.style.display = 'none';
    document.body.appendChild(music);
  }
  if (music.paused) void music.play().catch(() => undefined);
}
