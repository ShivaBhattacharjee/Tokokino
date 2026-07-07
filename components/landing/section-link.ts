export function scrollToHash(href: string) {
  const id = href.slice(1)
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function landingSectionHref(hash: string, pathname: string) {
  return pathname === "/" ? hash : `/${hash}`
}
