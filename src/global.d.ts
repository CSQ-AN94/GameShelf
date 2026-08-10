import type { GameShelfApi } from './shared';

declare global {
  interface Window {
    gameshelf: GameShelfApi;
  }
}

export {};
