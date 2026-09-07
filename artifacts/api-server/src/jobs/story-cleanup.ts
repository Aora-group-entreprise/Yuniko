import { db } from "@workspace/db";
import { storiesTable } from "@workspace/db/schema";
import { eq, lte } from "drizzle-orm";
import { deleteFromSupabaseStorage } from "../infrastructure/supabase-storage";

const BATCH_SIZE = 100;

export async function cleanupExpiredStories(): Promise<number> {
  const expired = await db.select({ id: storiesTable.id, mediaUrl: storiesTable.mediaUrl })
    .from(storiesTable)
    .where(lte(storiesTable.expiresAt, new Date()))
    .limit(BATCH_SIZE);

  let deleted = 0;
  for (const story of expired) {
    try {
      await deleteFromSupabaseStorage([story.mediaUrl]);
      await db.delete(storiesTable).where(eq(storiesTable.id, story.id));
      deleted++;
    } catch (error) {
      console.error("Failed to clean up expired story", story.id, error);
    }
  }
  return deleted;
}
