# Runs the multiplayer worker with plain workerd on the droplet (no wrangler, no node_modules).
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .game),
    (name = "do-disk", disk = (path = "/var/lib/game/do", writable = true)),
  ],
  sockets = [ (name = "http", address = "127.0.0.1:8787", http = (), service = "main") ],
);

const game :Workerd.Worker = (
  modules = [ (name = "index.js", esModule = embed "worker-dist/index.js") ],
  compatibilityDate = "2025-04-01",
  durableObjectNamespaces = [
    (className = "GameRoom", uniqueKey = "louisblox-game-room", enableSql = true),
    (className = "PlayerDirectory", uniqueKey = "louisblox-player-directory", enableSql = true),
  ],
  durableObjectStorage = (localDisk = "do-disk"),
  bindings = [
    (name = "GAME_ROOM", durableObjectNamespace = "GameRoom"),
    (name = "PLAYER_DIRECTORY", durableObjectNamespace = "PlayerDirectory"),
  ],
);
