# Faxi Market Research Infrastructure

This directory contains the templates and infrastructure for conducting comprehensive market research on Faxi's target Ideal Customer Profiles (ICPs).

## Directory Structure

```
research/
├── README.md                           # This file - overview and usage guide
├── master-research-document.md         # Main research document with all sections
├── icp-profile-template.md             # Template for creating individual ICP profiles
├── market-sizing-template.csv          # Spreadsheet for TAM/SAM/SOM calculations
├── revenue-model-template.csv          # Spreadsheet for revenue projections
├── citation-tracking.md                # Citation format standards and guidelines
└── citation-tracking.csv               # Spreadsheet for tracking all data sources
```

## How to Use This Infrastructure

### 1. Master Research Document

**File**: `master-research-document.md`

This is the primary deliverable - a comprehensive research document covering all four ICPs, competitive analysis, market sizing, cultural context, and website content strategy.

**Usage**:
- Start by reading through the entire structure to understand all sections
- Fill in sections progressively as research is conducted
- Replace all `[To be researched]` and `[To be developed]` placeholders with actual content
- Ensure every statistic and claim has a proper citation
- Use the document as a single source of truth for all market research

**Sections to Complete**:
1. Executive Summary (complete last, after all research is done)
2. ICP 1: Elder-Offline-Fax-Users
3. ICP 2: Online-Families
4. ICP 3: Business Partners
5. ICP 4: Investors
6. Competitive Analysis
7. Market Sizing & Opportunity
8. Cultural Context
9. Website Content Strategy
10. Data Source Appendix

### 2. ICP Profile Template

**File**: `icp-profile-template.md`

Use this template to create detailed standalone profiles for each ICP. These can be extracted from the master document or developed separately.

**Usage**:
- Copy the template for each ICP (4 copies total)
- Rename files: `icp-elder-offline-fax-users.md`, `icp-online-families.md`, `icp-business-partners.md`, `icp-investors.md`
- Fill in all sections with research findings
- Use validation checklist at bottom to track completion
- These profiles can be shared with stakeholders independently

**Key Sections**:
- Demographics: Quantitative data about the audience
- Psychographics: Qualitative insights about values, fears, aspirations
- Pain Points: Specific problems they experience
- Buying Journey: How they make decisions
- Value Proposition: What Faxi offers them
- Messaging Framework: How to communicate with them
- Acquisition Channels: How to reach them

### 3. Market Sizing Template

**File**: `market-sizing-template.csv`

Spreadsheet for calculating Total Addressable Market (TAM), Serviceable Addressable Market (SAM), and Serviceable Obtainable Market (SOM).

**Usage**:
- Open in Excel, Google Sheets, or Numbers
- Fill in population base and criteria for TAM
- Document all data sources with full citations
- Apply constraints to calculate SAM
- Project realistic SOM for years 1, 2, 3, and 5
- Run sensitivity analysis on key variables
- Verify data quality checks pass (TAM ≥ SAM ≥ SOM)

**Critical Requirements**:
- TAM must be ≥ SAM
- SAM must be ≥ SOM
- All assumptions must be documented
- All data sources must be cited
- Sensitivity analysis must consider optimistic and pessimistic scenarios

### 4. Revenue Model Template

**File**: `revenue-model-template.csv`

Spreadsheet for modeling revenue streams and financial projections.

**Usage**:
- Open in Excel, Google Sheets, or Numbers
- Model B2C subscription revenue (Basic and Premium tiers)
- Model B2B partner integration fees by partner type
- Model data monetization opportunities
- Create 3-year projections (5-year optional)
- Document all assumptions
- Calculate key metrics (LTV, CAC, ARPU, churn)

**Revenue Streams to Model**:
1. **B2C**: Elder user subscriptions (Basic ¥980/mo, Premium ¥1,980/mo)
2. **B2B**: Partner integration fees (Healthcare, E-commerce, Government, Advertisers)
3. **Data**: Anonymized insights and data products

**Key Metrics**:
- Customer Lifetime Value (LTV)
- Customer Acquisition Cost (CAC)
- LTV:CAC Ratio (should be > 3:1)
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Churn Rate
- Average Revenue Per Account (ARPA)

### 5. Citation Tracking System

**Files**: `citation-tracking.md` and `citation-tracking.csv`

System for ensuring all data is properly sourced and cited.

**Citation Format**:
```
[Statistic or claim]
Source: [Organization Name], "[Report Title]", [Publication Date], [URL], accessed [Access Date]
```

**Usage**:
- Read `citation-tracking.md` for complete guidelines
- Use `citation-tracking.csv` to track all sources
- Assign each source a unique ID (S001, S002, etc.)
- Record full citation information immediately when finding data
- Link citations in research document to source IDs
- Run quality checks before finalizing document

**Data Freshness Requirements**:
- Demographic data: Within 2 years
- Market statistics: Within 3 years
- Competitive intelligence: Within 1 year
- Technology trends: Within 1 year
- Pricing data: Within 6 months

**Credible Sources**:
- Government agencies (MIC, Statistics Bureau, METI)
- Industry associations (JBMIA, JEITA)
- Academic research (peer-reviewed journals)
- Market research firms (Gartner, IDC Japan, Yano Research)

## Research Workflow

### Phase 1: Secondary Research (Weeks 1-2)
1. Collect government statistics on elderly demographics
2. Research fax usage in Japan
3. Analyze technology adoption patterns
4. Review academic studies on digital divide
5. Compile competitive intelligence
6. Track all sources in `citation-tracking.csv`

### Phase 2: ICP Development (Weeks 2-3)
1. Create demographic profiles using `icp-profile-template.md`
2. Develop psychographic profiles
3. Map pain points and unmet needs
4. Document buying journeys
5. Fill in ICP sections in `master-research-document.md`

### Phase 3: Market Analysis (Weeks 3-4)
1. Calculate TAM/SAM/SOM using `market-sizing-template.csv`
2. Analyze competitive landscape
3. Develop positioning strategy
4. Model revenue opportunities using `revenue-model-template.csv`

### Phase 4: Messaging Development (Weeks 4-5)
1. Create value propositions for each ICP
2. Develop messaging frameworks
3. Design acquisition channel strategies
4. Draft website content guidelines

### Phase 5: Validation & Refinement (Week 5-6)
1. Run data quality checks
2. Verify all citations are complete
3. Validate TAM ≥ SAM ≥ SOM
4. Conduct peer reviews
5. Incorporate stakeholder feedback
6. Finalize all documents

## Quality Standards

### Data Quality
- ✅ All statistics have credible source citations
- ✅ All citations include required fields (organization, title, date, URL, access date)
- ✅ Data is within freshness requirements for its type
- ✅ Market sizing follows TAM ≥ SAM ≥ SOM hierarchy
- ✅ All projections document assumptions
- ✅ Sensitivity analysis considers multiple scenarios

### Content Quality
- ✅ All ICP profiles are complete per template
- ✅ All competitor profiles include required fields
- ✅ Value propositions are clear and differentiated
- ✅ Messaging frameworks are actionable
- ✅ Cultural insights are validated by native speakers
- ✅ No unsubstantiated claims or opinions

### Document Quality
- ✅ Professional formatting and organization
- ✅ Consistent terminology throughout
- ✅ Clear section headings and navigation
- ✅ Tables and charts are properly formatted
- ✅ Executive summary synthesizes key findings
- ✅ Recommendations are specific and actionable

## Deliverables Checklist

### Core Deliverables (Required)
- [ ] Master Research Document (50-80 pages)
- [ ] Executive Summary (5-7 pages)
- [ ] ICP Profile: Elder-Offline-Fax-Users (8-10 pages)
- [ ] ICP Profile: Online-Families (8-10 pages)
- [ ] ICP Profile: Business Partners (8-10 pages)
- [ ] Competitive Analysis Document (10-15 pages)
- [ ] Market Sizing Spreadsheet (completed)
- [ ] Revenue Model Spreadsheet (3-year projections)
- [ ] Messaging Guide for Core ICPs (12-15 pages)
- [ ] Website Content Strategy (8-12 pages)
- [ ] Data Source Appendix (5-10 pages)

### Extended Deliverables (Optional)
- [ ] ICP Profile: Investors (8-10 pages)
- [ ] Advanced Revenue Model (5-year projections with sensitivity)
- [ ] Investor Messaging Framework
- [ ] Investor Page Content Strategy

## Tips for Success

### Research Best Practices
1. **Start with credible sources**: Government data and industry associations first
2. **Document as you go**: Don't wait to add citations later
3. **Cross-reference data**: Verify important statistics with multiple sources
4. **Be conservative**: Use realistic, defensible assumptions in projections
5. **Think like the audience**: Put yourself in each ICP's shoes
6. **Validate culturally**: Get native Japanese speaker review for cultural content

### Common Pitfalls to Avoid
- ❌ Using outdated data without noting limitations
- ❌ Making claims without citations
- ❌ Copying competitor analysis without verification
- ❌ Overly optimistic market sizing or revenue projections
- ❌ Generic messaging that could apply to any product
- ❌ Cultural stereotypes instead of research-based insights
- ❌ Incomplete ICP profiles missing key sections

### Efficiency Tips
1. Use templates consistently - don't reinvent structure
2. Set up citation tracking from day one
3. Block time for focused research vs. writing
4. Review and validate incrementally, not all at end
5. Get early feedback from stakeholders on direction
6. Reuse research across multiple sections where relevant

## Support and Questions

If you have questions about:
- **Research methodology**: Refer to design.md for detailed approach
- **Requirements**: Refer to requirements.md for acceptance criteria
- **Task sequence**: Refer to tasks.md for implementation plan
- **Citation format**: Refer to citation-tracking.md for standards

## Version History

- **v1.0** (2024-11-27): Initial infrastructure setup with all templates

---

**Ready to start?** Begin with Phase 1: Secondary Research. Open `citation-tracking.csv` and start documenting sources as you find them!
