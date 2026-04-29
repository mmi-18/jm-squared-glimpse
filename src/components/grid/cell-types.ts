import type { PostRow, StyleVector, UserRow, ReviewRow } from "@/lib/types";

/**
 * Polymorphic cell payloads. A SpanGrid cell's `data` field is one of these.
 * A single renderer (PostCellRenderer, ProfileCellRenderer) dispatches on `kind`.
 *
 * Text cells render at a single compact "caption" size — small enough to sit
 * comfortably under or alongside image tiles without dominating the grid.
 * Earlier headline/body variants were dropped: anything bigger than caption
 * was never the right move inside a tile.
 */

export type ImageFit = "cover" | "contain";
export type ImagePosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | `${number}% ${number}%`;

export type PostCellData =
  | {
      kind: "image";
      src: string;
      alt?: string;
      caption?: string;
      /**
       * How the image fills its cell:
       *   - `cover` (default) — crop to fill the cell, no whitespace
       *   - `contain` — whole image visible; when `blurFill` is true, the
       *     empty area is filled with a blurred extract of the same image
       */
      fit?: ImageFit;
      /** Object-position. Default "center". Used when fit is `cover`. */
      position?: ImagePosition;
      /** When true + fit=contain, render a blurred background of the image. */
      blurFill?: boolean;
    }
  | {
      kind: "text";
      content: string;
      align?: "left" | "center";
    }
  | {
      kind: "voice";
      seed: string;
      durationSec?: number;
    }
  | {
      kind: "styleDimensions";
      vector: StyleVector;
      label?: string;
    }
  | {
      kind: "tags";
      tags: string[];
      heading?: string;
    };

export type ProfileCellData =
  | {
      kind: "about";
      bio: string | null;
    }
  | {
      kind: "voice";
      seed: string;
    }
  | {
      kind: "radar";
      vector: StyleVector;
    }
  | {
      kind: "portfolioPost";
      post: PostRow;
    }
  | {
      kind: "tags";
      tags: string[];
      heading: string;
    }
  | {
      kind: "rate";
      min: number | null;
      max: number | null;
      /** When false, the rate shows blurred with a "visible after match" hint. */
      visible: boolean;
    }
  | {
      kind: "reviews";
      reviews: Array<
        Pick<
          ReviewRow,
          | "id"
          | "projectDescription"
          | "ratingOverall"
          | "ratingReliability"
          | "ratingQuality"
          | "ratingCollaboration"
          | "reviewText"
          | "createdAt"
        > & {
          reviewer: Pick<UserRow, "id" | "name" | "image">;
        }
      >;
      avg: {
        overall: number;
        reliability: number;
        quality: number;
        collaboration: number;
      };
    }
  | {
      kind: "text";
      content: string;
    };
