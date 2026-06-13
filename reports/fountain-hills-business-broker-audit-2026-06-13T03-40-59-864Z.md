# Live-diff audit — fountain-hills-business-broker

- Live:  https://www.philsellsbiz.com/fountain-hills-business-broker/
- Local: http://localhost:4323/fountain-hills-business-broker/
- When:  2026-06-13T03:40:59.865Z

## 🔴 Must fix

_None._

## 🟡 Should fix

- Structural block extra on local — `main`: live=0, local=1 (+1)

- Callout / tip / aside count differs slightly: live=1, local=0 (diff +1). May be a single overlooked aside, or acceptable noise (e.g. a live `.warn` rendered as a bullet list on local).


## 🟢 Acceptable / informational

- JSON-LD @type(s) on local but not live (extra): LocalBusiness, LocalBusiness, PostalAddress, PostalAddress, Service, Service, City, City, State, State, ProfessionalService, ProfessionalService


## Summary

- Live headings: 27 | Local: 27
- Live images:   14 | Local: 14
- Live <picture><source>: 0 | Local: 0
- Live videos:   0 | Local: 0
- Live iframes:  1 | Local: 1
- Asset URLs on local checked: 14, broken: 0
- Consecutive <figure> runs — live: 0 (total 0 figures) | local: 0 (total 0 figures)
- Callout / tip / info-box blocks — live: 1 | local: 0
- Structural blocks (live vs local):
  - section: 10 vs 10
  - article: 3 vs 3
  - main: 0 vs 1
  - fusionRow: 0 vs 0
  - elementorSection: 0 vs 0
  - awbToc: 0 vs 0
- JSON-LD types — live: [WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FAQPage, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization] | local: [LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, Service, City, State, ProfessionalService, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, Service, City, State, ProfessionalService, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FAQPage, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization]

---

> Deterministic checks only. For qualitative visual review (screenshots,
> color rhythm, missing UI blocks), invoke the **live-diff-auditor** agent
> and pass it this report as context.