let joinOnlyRoom: string | null = null;

export function setJoinOnlyRoom(room: string | null) {
  joinOnlyRoom = room;
}

export function isJoinOnlyRoom(room: string) {
  return joinOnlyRoom === room;
}
