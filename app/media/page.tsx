import { redirect } from "next/navigation";

/**
 * The standalone Media page was retired after its useful, unique parts
 * (upload, download/delete, multi-select ZIP, provider notices) were absorbed
 * by the Media Library at /studio/assets. Omni Imagine (image generation) and
 * Media Library both remain, as documented in the navigation restructure.
 *
 * This route survives only so old bookmarks and deep links land somewhere
 * useful instead of 404ing.
 */
export default function MediaPage() {
  redirect("/studio/assets");
}
