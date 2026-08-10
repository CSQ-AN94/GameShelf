export type GameType = 'visual_novel' | 'rpg' | 'simulation' | 'action' | 'other';
export type ContentRating = 'general' | 'mature' | 'r18';
export type GameStatus = 'unplayed' | 'playing' | 'completed' | 'paused';

export interface Game {
  id: string;
  title: string;
  type: GameType;
  contentRating: ContentRating;
  executablePath: string;
  workingDirectory: string;
  launchArguments: string;
  coverPath: string | null;
  coverDataUrl?: string | null;
  backgroundPath: string | null;
  developer: string;
  releaseDate: string | null;
  languages: string[];
  score: number | null;
  description: string;
  status: GameStatus;
  totalPlaySeconds: number;
  launchCount: number;
  lastPlayedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewGameInput {
  title: string;
  type: GameType;
  contentRating: ContentRating;
  executablePath: string;
  launchArguments?: string;
  coverSourcePath?: string | null;
  developer?: string;
  description?: string;
  status?: GameStatus;
}

export interface PickedImage {
  path: string;
  dataUrl: string;
}

export interface GameCollection {
  id: string;
  name: string;
  gameIds: string[];
  createdAt: string;
}

export interface UserProfile {
  name: string;
  avatarPath: string | null;
  avatarDataUrl?: string | null;
}

export interface ProfileInput {
  name: string;
  avatarSourcePath?: string | null;
}

export interface GameShelfApi {
  listGames: () => Promise<Game[]>;
  getGame: (id: string) => Promise<Game | null>;
  addGame: (input: NewGameInput) => Promise<Game>;
  updateGameStatus: (id: string, status: GameStatus) => Promise<Game>;
  pickExecutable: () => Promise<string | null>;
  pickCover: () => Promise<PickedImage | null>;
  launchGame: (id: string) => Promise<void>;
  listCollections: () => Promise<GameCollection[]>;
  createCollection: (name: string) => Promise<GameCollection>;
  setGameCollections: (gameId: string, collectionIds: string[]) => Promise<void>;
  getProfile: () => Promise<UserProfile>;
  saveProfile: (input: ProfileInput) => Promise<UserProfile>;
}
