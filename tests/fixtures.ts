import { faker } from "@faker-js/faker"

/**
 * Shared, deterministic fake data for tests. Seeding faker keeps generated
 * values stable across runs so assertions stay reproducible, while still using
 * realistic-looking data (avatar URLs, names, images) instead of literal
 * `example.com` placeholders. Each test file gets its own module instance, so
 * the seeded sequence is deterministic per file.
 */
faker.seed(20240617)

export { faker }

/** A realistic avatar image URL (e.g. an avatar host, not example.com). */
export const fakeAvatarUrl = () => faker.image.avatar()

/** A realistic random image URL (Picsum/LoremFlickr style). */
export const fakeImageUrl = () => faker.image.url()

/** A realistic person's full name. */
export const fakeName = () => faker.person.fullName()
