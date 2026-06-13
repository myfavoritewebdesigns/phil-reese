# Live-diff audit — mesa-business-broker

- Live:  https://www.philsellsbiz.com/mesa-business-broker/
- Local: http://localhost:4323/mesa-business-broker/
- When:  2026-06-13T03:31:15.672Z

## 🔴 Must fix

- **JSON-LD @type(s) on live but missing on local:** UNPARSEABLE


## 🟡 Should fix

- Structural block extra on local — `main`: live=0, local=1 (+1)


## 🟢 Acceptable / informational

- JSON-LD @type(s) on local but not live (extra): LocalBusiness, LocalBusiness, PostalAddress, PostalAddress, FAQPage, Question, Question, Question, Question, Question, Question, Question, Answer, Answer, Answer, Answer, Answer, Answer, Answer


## Summary

- Live headings: 32 | Local: 32
- Live images:   19 | Local: 19
- Live <picture><source>: 0 | Local: 0
- Live videos:   0 | Local: 0
- Live iframes:  1 | Local: 1
- Asset URLs on local checked: 19, broken: 0
- Consecutive <figure> runs — live: 0 (total 0 figures) | local: 0 (total 0 figures)
- Callout / tip / info-box blocks — live: 0 | local: 0
- Structural blocks (live vs local):
  - section: 12 vs 12
  - article: 0 vs 0
  - main: 0 vs 1
  - fusionRow: 0 vs 0
  - elementorSection: 0 vs 0
  - awbToc: 0 vs 0
- JSON-LD types — live: [WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, UNPARSEABLE, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization] | local: [LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FAQPage, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization]

---

> Deterministic checks only. For qualitative visual review (screenshots,
> color rhythm, missing UI blocks), invoke the **live-diff-auditor** agent
> and pass it this report as context.