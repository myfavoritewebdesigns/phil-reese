# Live-diff audit — sun-city-business-broker

- Live:  https://www.philsellsbiz.com/sun-city-business-broker/
- Local: http://localhost:4323/sun-city-business-broker/
- When:  2026-06-13T03:44:20.318Z

## 🔴 Must fix

- **1 heading(s) on live but missing on local:**
  - h2#- Helping Business Owners Sell In Sun City For Over 24 Years

- **Structural block mismatch — `section`:** live=11, local=10 (missing 1 on local)

- **Image count mismatch:** live=22, local=21 (missing 1 on local)


## 🟡 Should fix

- Structural block extra on local — `main`: live=0, local=1 (+1)


## 🟢 Acceptable / informational

- JSON-LD @type(s) on local but not live (extra): LocalBusiness, LocalBusiness, PostalAddress, PostalAddress, Service, Service, City, City, State, State, ProfessionalService, ProfessionalService


## Summary

- Live headings: 39 | Local: 38
- Live images:   22 | Local: 21
- Live <picture><source>: 0 | Local: 0
- Live videos:   0 | Local: 0
- Live iframes:  0 | Local: 0
- Asset URLs on local checked: 21, broken: 0
- Consecutive <figure> runs — live: 0 (total 0 figures) | local: 0 (total 0 figures)
- Callout / tip / info-box blocks — live: 0 | local: 0
- Structural blocks (live vs local):
  - section: 11 vs 10
  - article: 0 vs 0
  - main: 0 vs 1
  - fusionRow: 0 vs 0
  - elementorSection: 0 vs 0
  - awbToc: 0 vs 0
- JSON-LD types — live: [WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FAQPage, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization] | local: [LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, LocalBusiness, PostalAddress, WebSite, SearchAction, EntryPoint, PropertyValueSpecification, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, Service, City, State, ProfessionalService, WebPage, ReadAction, ImageObject, BreadcrumbList, ListItem, ListItem, Service, City, State, ProfessionalService, FinancialService, QuantitativeValue, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, AdministrativeArea, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FinancialService, PostalAddress, ContactPoint, GeoCoordinates, AggregateRating, Offer, Service, Offer, Service, Offer, Service, Offer, Service, FAQPage, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Question, Answer, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization, Review, ProfessionalService, Person, Rating, Organization]

---

> Deterministic checks only. For qualitative visual review (screenshots,
> color rhythm, missing UI blocks), invoke the **live-diff-auditor** agent
> and pass it this report as context.