/**
 * Shared shape for the encode workers' request/response protocols.
 */

/**
 * `Omit` over a union collapses it to the keys every member shares, which would
 * erase each message's payload — distribute it instead. Used so a client can
 * build a message without minting the correlation id itself.
 */
export type WithoutId<T> = T extends { id: number } ? Omit<T, "id"> : never
