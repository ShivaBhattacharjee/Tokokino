import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator"

export function randomDisplayName() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: " ",
    style: "capital",
    length: 3,
  })
}
