export type GameType = 'visual_novel' | 'rpg' | 'simulation' | 'action' | 'other';
export type ContentRating = 'general' | 'mature' | 'r18';
export type GameStatus = 'unplayed' | 'playing' | 'completed' | 'paused';

export interface Game {
  id: string;
  title: string;
  chineseTitle: string;
  type: GameType;
  category: string;
  contentRating: ContentRating;
  executablePath: string;
  workingDirectory: string;
  launchArguments: string;
  coverPath: string | null;
  coverDataUrl?: string | null;
  backgroundPath: string | null;
  backgroundDataUrl?: string | null;
  developer: string;
  releaseDate: string | null;
  languages: string[];
  score: number | null;
  description: string;
  status: GameStatus;
  wishlist: boolean;
  hideInSafeView: boolean;
  launchProfiles: LaunchProfile[];
  totalPlaySeconds: number;
  launchCount: number;
  lastPlayedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewGameInput {
  title: string;
  chineseTitle?: string;
  type: GameType;
  category?: string;
  contentRating: ContentRating;
  executablePath: string;
  launchArguments?: string;
  coverSourcePath?: string | null;
  developer?: string;
  description?: string;
  status?: GameStatus;
  wishlist?: boolean;
  hideInSafeView?: boolean;
}

export interface LaunchProfile {
  id: string;
  name: string;
  executablePath: string;
  workingDirectory: string;
  launchArguments: string;
  isDefault: boolean;
}

export interface LaunchProfileInput {
  id?: string;
  name: string;
  executablePath: string;
  launchArguments?: string;
  isDefault?: boolean;
}

export interface GameSettingsInput {
  title: string;
  chineseTitle: string;
  wishlist: boolean;
  hideInSafeView: boolean;
  coverSourcePath?: string | null;
  backgroundSourcePath?: string | null;
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

export type ThemeMode = 'dark' | 'light';
export type TitleDisplayMode = 'original' | 'chinese';
export type LibraryViewMode = 'grid' | 'list';

export interface AppPreferences {
  theme: ThemeMode;
  titleDisplayMode: TitleDisplayMode;
  libraryViewMode: LibraryViewMode;
  safeView: boolean;
  sidebarCollapsed: boolean;
}

export interface LibraryScanCandidate {
  id: string;
  folderPath: string;
  title: string;
  titleOptions: { value: string; source: string }[];
  chineseTitle: string;
  type: GameType;
  category: string;
  contentRating: ContentRating;
  executablePath: string;
  launchProfiles: LaunchProfileInput[];
  coverSourcePath: string | null;
  engine: string | null;
  issues: string[];
  duplicatePath: boolean;
  duplicateGameId: string | null;
  relatedCandidateIds: string[];
}

export interface BatchImportInput extends NewGameInput {
  launchProfiles: LaunchProfileInput[];
}

export interface BulkEditGamesInput {
  gameIds: string[];
  status?: GameStatus;
  category?: string;
  hideInSafeView?: boolean;
  addCollectionIds?: string[];
}

export interface DataOperationResult {
  message: string;
  path: string;
}

export interface GameSetupAnalysis {
  engine: string | null;
  suggestedType: GameType;
  suggestedCategory: string;
  alternativeExecutables: string[];
  modDirectories: string[];
  saveDirectories: string[];
  patchDirectories: string[];
}

export interface GameShelfApi {
  listGames: () => Promise<Game[]>;
  getGame: (id: string) => Promise<Game | null>;
  addGame: (input: NewGameInput) => Promise<Game>;
  scanLibrary: () => Promise<LibraryScanCandidate[] | null>;
  importGames: (inputs: BatchImportInput[]) => Promise<Game[]>;
  bulkEditGames: (input: BulkEditGamesInput) => Promise<Game[]>;
  removeGame: (id: string) => Promise<void>;
  updateGameStatus: (id: string, status: GameStatus) => Promise<Game>;
  updateGameCategory: (id: string, category: string) => Promise<Game>;
  updateGameSettings: (id: string, input: GameSettingsInput) => Promise<Game>;
  saveLaunchProfile: (gameId: string, input: LaunchProfileInput) => Promise<Game>;
  deleteLaunchProfile: (gameId: string, profileId: string) => Promise<Game>;
  pickExecutable: () => Promise<string | null>;
  analyzeExecutable: (executablePath: string) => Promise<GameSetupAnalysis>;
  pickCover: () => Promise<PickedImage | null>;
  pickBackground: () => Promise<PickedImage | null>;
  launchGame: (id: string, profileId?: string) => Promise<void>;
  openGameDirectory: (id: string) => Promise<string>;
  listCollections: () => Promise<GameCollection[]>;
  createCollection: (name: string) => Promise<GameCollection>;
  setGameCollections: (gameId: string, collectionIds: string[]) => Promise<void>;
  getProfile: () => Promise<UserProfile>;
  saveProfile: (input: ProfileInput) => Promise<UserProfile>;
  getPreferences: () => Promise<AppPreferences>;
  savePreferences: (preferences: AppPreferences) => Promise<AppPreferences>;
  openDataDirectory: () => Promise<string>;
  createBackup: () => Promise<DataOperationResult>;
  restoreBackup: () => Promise<DataOperationResult | null>;
  exportDiagnostics: () => Promise<DataOperationResult | null>;
}
