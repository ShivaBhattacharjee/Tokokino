-- Poster still-frame for animate (video/gif) shares so the gallery can show a
-- real thumbnail instead of a placeholder film icon. Nullable: still shares and
-- pre-existing animate shares have no poster.
ALTER TABLE "shares" ADD COLUMN "poster_key" TEXT;
