const SITE_URL = "https://tokokino.com"
const PAGE_URL = `${SITE_URL}/how-it-works`

type Step = {
  name: string
  body: string
  anchor: string
}

type Faq = {
  q: string
  a: string
}

export function howItWorksStructuredData({
  steps,
  faqs,
}: {
  steps: readonly Step[]
  faqs: readonly Faq[]
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        "@id": `${PAGE_URL}/#howto`,
        name: "How to make a polished product screenshot or animated demo",
        description:
          "Bring in a capture, frame it, style the scene, add context, animate the key moments, then export a still or a video — all in the browser.",
        url: PAGE_URL,
        totalTime: "PT5M",
        estimatedCost: {
          "@type": "MonetaryAmount",
          currency: "USD",
          value: "0",
        },
        tool: {
          "@type": "HowToTool",
          name: "Tokokino",
        },
        step: steps.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name: step.name,
          text: step.body,
          url: `${PAGE_URL}#${step.anchor}`,
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
            name: "How it works",
            item: PAGE_URL,
          },
        ],
      },
    ],
  }
}
