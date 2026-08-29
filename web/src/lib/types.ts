/**
 * Shared data types for BloxBuilt builds.
 *
 * A "build" is a Bloxburg house listing shown in the public gallery and
 * managed from the secret admin panel. Prices are stored as raw numbers and
 * formatted for display.
 */

export interface Build {
  /** Stable unique id (also the Build ID customers copy into the Discord bot). */
  id: string;
  name: string;
  description: string;
  /** Free-text category, e.g. "mansion", "starter", "modern". */
  category: string;
  /** In-game cash price (Bloxburg dollars). */
  cashPrice: number;
  /** Blockbux price (B$). */
  blockbux: number;
  /** Required gamepass names. */
  gamepasses: string[];
  /** Ordered image URLs (first is the cover). */
  images: string[];
  /** Display name of who uploaded it (e.g. "1SH"). */
  uploader: string;
  /** Optional avatar URL for the uploader. */
  uploaderAvatar?: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

/** Payload accepted when creating/updating a build (timestamps handled server-side). */
export interface BuildInput {
  /** Optional custom Build ID. If omitted on create, one is generated. */
  id?: string;
  name: string;
  description: string;
  category: string;
  cashPrice: number;
  blockbux: number;
  gamepasses: string[];
  images: string[];
  uploader: string;
  uploaderAvatar?: string;
}
