const SITE_URL = "https://tokokino.com"
const PAGE_URL = `${SITE_URL}/use-cases`

type UseCase = {
  title: string
  body: string
}

type Faq = {
  q: string
  a: string
}

export function useCasesStructuredData({
  cases,
  faqs,
}: {
  cases: readonly UseCase[]
  faqs: readonly Faq[]
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        "@id": `${PAGE_URL}/#use-cases`,
        name: "What people build with Tokokino",
        description:
          "Launch posts, app store screenshots, animated product demos, changelog images, documentation stills, landing page visuals, and social proof.",
        url: PAGE_URL,
        numberOfItems: cases.length,
        itemListElement: cases.map((useCase, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: useCase.title,
          description: useCase.body,
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${PAGE_URL}/#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${PAGE_URL}/#breadcrumbs`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Tokokino",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Use cases",
            item: PAGE_URL,
          },
        ],
      },
    ],
  }
}
