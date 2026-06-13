# Live-diff audit — testimonials

- Live:  https://www.philsellsbiz.com/testimonials/
- Local: http://localhost:4323/testimonials/
- When:  2026-06-13T02:46:41.509Z

## 🔴 Must fix

- **JSON-LD @type(s) on live but missing on local:** WebPage, ReadAction, ImageObject, ImageObject, BreadcrumbList, ListItem, ListItem, FinancialService, FinancialService, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, ContactPoint, ContactPoint, GeoCoordinates, GeoCoordinates, GeoCoordinates, AggregateRating, AggregateRating, AggregateRating, Offer, Offer, Offer, Offer, Offer, Offer, Offer, Offer, Offer, Offer, Offer, Offer, Service, Service, Service, Service, Service, Service, Service, Service, Service, Service, Service, Service, AdministrativeArea


## 🟡 Should fix

- Structural block extra on local — `main`: live=0, local=1 (+1)


## 🟢 Acceptable / informational

- JSON-LD @type(s) on local but not live (extra): LocalBusiness, LocalBusiness, LocalBusiness, LocalBusiness, LocalBusiness, Review, Review, Review, Person, Person, Person, Rating, Rating, Rating


## Summary

- Live headings: 10 | Local: 10
- Live images:   16 | Local: 16
- Live <picture><source>: 0 | Local: 0
- Live videos:   0 | Local: 0
- Live iframes:  4 | Local: 4
- Asset URLs on local checked: 16, broken: 0
- Consecutive <figure> runs — live: 0 (total 0 figures) | local: 0 (total 0 figures)
- Callout / tip / info-box blocks — live: 0 | local: 0
- Structural blocks (live vs local):
  - section: 12 vs 12
  - article: 0 vs 0
  - main: 0 vs 1
  - fusionRow: 0 vs 0
  - elementorSection: 0 vs 0
  - awbToc: 0 vs 0
- JSON-LD types — live: [WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service] | local: [LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, BreadcrumbList, ListItem, ListItem, Review, Person, Rating, LocalBusiness, Review, Person, Rating, LocalBusiness, Review, Person, Rating, LocalBusiness]

---

> Deterministic checks only. For qualitative visual review (screenshots,
> color rhythm, missing UI blocks), invoke the **live-diff-auditor** agent
> and pass it this report as context.