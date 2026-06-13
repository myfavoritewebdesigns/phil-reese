# Live-diff audit — scottsdale-business-broker

- Live:  https://www.philsellsbiz.com/scottsdale-business-broker/
- Local: http://localhost:4323/scottsdale-business-broker/
- When:  2026-06-13T03:35:28.932Z

## 🔴 Must fix

_None._

## 🟡 Should fix

- Structural block extra on local — `main`: live=0, local=1 (+1)


## 🟢 Acceptable / informational

- JSON-LD @type(s) on local but not live (extra): LocalBusiness, LocalBusiness, PostalAddress, PostalAddress


## Summary

- Live headings: 6 | Local: 6
- Live images:   13 | Local: 13
- Live <picture><source>: 0 | Local: 0
- Live videos:   0 | Local: 0
- Live iframes:  0 | Local: 0
- Asset URLs on local checked: 13, broken: 0
- Consecutive <figure> runs — live: 0 (total 0 figures) | local: 0 (total 0 figures)
- Callout / tip / info-box blocks — live: 0 | local: 0
- Structural blocks (live vs local):
  - section: 6 vs 6
  - article: 0 vs 0
  - main: 0 vs 1
  - fusionRow: 0 vs 0
  - elementorSection: 0 vs 0
  - awbToc: 0 vs 0
- JSON-LD types — live: [WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization] | local: [LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization]

---

> Deterministic checks only. For qualitative visual review (screenshots,
> color rhythm, missing UI blocks), invoke the **live-diff-auditor** agent
> and pass it this report as context.