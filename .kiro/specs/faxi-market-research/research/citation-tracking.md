# Citation and Source Tracking System

## Citation Format Standard

All statistics, data points, and claims in the research document must follow this format:

```
[Statistic or claim]
Source: [Organization Name], "[Report Title]", [Publication Date], [URL], accessed [Access Date]
```

### Example Citations

**Good Example**:
```
10 million active fax users in Japan
Source: Ministry of Internal Affairs and Communications, "Communications Usage Trend Survey 2023", 
August 2023, https://www.soumu.go.jp/johotsusintokei/statistics/statistics05.html, accessed November 27, 2024
```

**Good Example**:
```
65+ population represents 29.1% of total Japanese population
Source: Statistics Bureau of Japan, "Population Estimates", October 2023, 
https://www.stat.go.jp/english/data/jinsui/index.html, accessed November 27, 2024
```

## Source Quality Criteria

### Credible Sources (Preferred)

1. **Government Agencies**
   - Ministry of Internal Affairs and Communications (MIC)
   - Statistics Bureau of Japan
   - Ministry of Economy, Trade and Industry (METI)
   - Ministry of Health, Labour and Welfare
   - Consumer Affairs Agency

2. **Industry Associations**
   - Japan Business Machine and Information System Industries Association (JBMIA)
   - Japan Electronics and Information Technology Industries Association (JEITA)
   - Telecommunications Carriers Association

3. **Academic Research**
   - Peer-reviewed journals
   - University research centers
   - Academic conferences

4. **Market Research Firms**
   - Gartner
   - IDC Japan
   - Yano Research Institute
   - Fuji Chimera Research Institute

### Data Freshness Requirements

| Data Type | Maximum Age | Rationale |
|-----------|-------------|-----------|
| Demographic data | 2 years | Population changes slowly |
| Market statistics | 3 years | Market trends evolve gradually |
| Competitive intelligence | 1 year | Competitive landscape changes quickly |
| Technology trends | 1 year | Technology evolves rapidly |
| Pricing data | 6 months | Pricing can change frequently |

## Source Tracking Table

| Source ID | Organization | Report Title | Publication Date | URL | Access Date | Data Type | Used In Section |
|-----------|--------------|--------------|------------------|-----|-------------|-----------|-----------------|
| S001 | Statistics Bureau of Japan | Population Estimates Monthly Report | October 2023 | https://www.stat.go.jp/english/data/jinsui/index.html | November 27, 2024 | Demographic | ICP 1 - Age Range, Market Size |
| S002 | Ministry of Health, Labour and Welfare | Life Expectancy and Healthy Life Expectancy 2023 | July 2023 | https://www.mhlw.go.jp/english/database/db-hw/index.html | November 27, 2024 | Demographic | ICP 1 - Gender Distribution |
| S003 | Statistics Bureau of Japan | Population Census 2020 - Age Distribution by Prefecture | June 2021 | https://www.stat.go.jp/english/data/kokusei/index.html | November 27, 2024 | Demographic | ICP 1 - Geographic Distribution |
| S004 | Ministry of Health, Labour and Welfare | Comprehensive Survey of Living Conditions 2022 | July 2023 | https://www.mhlw.go.jp/english/database/db-hss/cslc-index.html | November 27, 2024 | Economic | ICP 1 - Income Level |
| S005 | Statistics Bureau of Japan | Employment Status Survey 2022 | July 2023 | https://www.stat.go.jp/english/data/shugyou/index.html | November 27, 2024 | Demographic | ICP 1 - Education Level |
| S006 | National Institute of Population and Social Security Research | Household Projections for Japan 2023 | April 2023 | https://www.ipss.go.jp/pp-ajsetai/e/index.html | November 27, 2024 | Demographic | ICP 1 - Living Situation |
| S007 | Ministry of Internal Affairs and Communications | Communications Usage Trend Survey 2023 | August 2023 | https://www.soumu.go.jp/johotsusintokei/statistics/statistics05.html | November 27, 2024 | Technology | ICP 1 - Technology Adoption, Fax Usage |
| S008 | Cabinet Office | Survey on Attitudes of the Elderly 2023 | March 2023 | https://www8.cao.go.jp/kourei/english/index.html | November 27, 2024 | Psychographic | ICP 1 - Technology Anxiety |
| S009 | Statistics Bureau of Japan | Population Projections for Japan 2023 | April 2023 | https://www.stat.go.jp/english/data/jinsui/index.html | November 27, 2024 | Market Sizing | ICP 1 - Market Growth Trends |

## Data Quality Checklist

Use this checklist to validate data quality before including in research document:

### For Each Statistic or Data Point

- [ ] Source is from credible organization (government, industry association, academic, reputable market research)
- [ ] Publication date is within acceptable freshness window for data type
- [ ] Full citation includes: organization name, report title, publication date, URL, access date
- [ ] Data methodology is documented (sample size, collection method) where available
- [ ] Data is relevant to Japanese market (not global data unless specifically noted)
- [ ] Data supports the claim being made (no misrepresentation)
- [ ] Alternative or conflicting data sources have been considered
- [ ] Data has been cross-referenced with other sources when possible

### For Market Sizing Data

- [ ] TAM calculation uses credible population/market data
- [ ] SAM constraints are clearly documented and justified
- [ ] SOM projections include realistic assumptions
- [ ] Mathematical relationship TAM ≥ SAM ≥ SOM is maintained
- [ ] All assumptions are explicitly documented
- [ ] Sensitivity analysis considers key variables
- [ ] Projections are conservative and defensible

### For Competitive Analysis

- [ ] Competitor information is from public sources
- [ ] Competitive claims are objective and evidence-based
- [ ] Market positioning is based on observable facts
- [ ] Pricing information is current (within 6 months)
- [ ] Strengths and weaknesses are balanced and fair

### For Cultural Insights

- [ ] Cultural claims are validated by native Japanese speakers
- [ ] Cultural insights are based on research, not stereotypes
- [ ] Business culture information is from credible sources
- [ ] Communication norms are appropriate for target audience
- [ ] Cultural sensitivities have been reviewed

## Citation Management Workflow

### Step 1: Research Phase
- As you find relevant data, immediately record in Source Tracking Table
- Capture full citation information at time of discovery
- Note which section of research document will use this data
- Save PDF or screenshot of source for reference

### Step 2: Writing Phase
- Insert inline citations in research document using standard format
- Link citation to Source ID in tracking table
- Ensure every quantitative claim has a citation
- Flag any claims that need additional source validation

### Step 3: Review Phase
- Run automated scan for statistics without citations
- Verify all URLs are accessible
- Check publication dates against freshness requirements
- Validate that sources meet credibility criteria
- Cross-reference claims with multiple sources where possible

### Step 4: Finalization Phase
- Compile complete Data Source Appendix
- Organize sources by category (government, industry, academic, etc.)
- Include methodology notes where relevant
- Document any limitations or caveats about data quality

## Common Citation Errors to Avoid

❌ **Missing publication date**: "Ministry of Internal Affairs, Communications Survey"
✅ **Correct**: "Ministry of Internal Affairs and Communications, 'Communications Usage Trend Survey 2023', August 2023"

❌ **No access date**: "Source: Statistics Bureau, https://www.stat.go.jp/..."
✅ **Correct**: "Source: Statistics Bureau, https://www.stat.go.jp/..., accessed November 27, 2024"

❌ **Vague source**: "According to government data..."
✅ **Correct**: "Source: Ministry of Economy, Trade and Industry, 'E-Commerce Market Survey 2023', June 2023"

❌ **Outdated data**: Using 2018 demographic data in 2024
✅ **Correct**: Using most recent data within freshness window, noting if older data is used with justification

❌ **Uncited claim**: "Most elderly Japanese prefer fax over email"
✅ **Correct**: "67% of Japanese seniors aged 65+ report preferring fax communication over email. Source: [Full citation]"

## Tools and Resources

### Recommended Citation Management
- Use spreadsheet (citation-tracking.csv) for source tracking
- Use markdown comments in research document to link to source IDs
- Maintain separate folder for source PDFs and screenshots

### Japanese Government Data Sources
- **MIC Statistics**: https://www.soumu.go.jp/english/index.html
- **Statistics Bureau**: https://www.stat.go.jp/english/
- **METI**: https://www.meti.go.jp/english/
- **e-Stat Portal**: https://www.e-stat.go.jp/en

### Market Research Resources
- **JETRO**: https://www.jetro.go.jp/en/
- **Japan External Trade Organization**: Market reports and statistics
- **Yano Research Institute**: Industry reports (subscription may be required)

## Quality Assurance

### Before Submitting Research Document

Run through this final checklist:

- [ ] All statistics have proper citations
- [ ] All citations include required fields (organization, title, date, URL, access date)
- [ ] All sources meet credibility criteria
- [ ] All data is within freshness requirements
- [ ] Source Tracking Table is complete
- [ ] Data Source Appendix is compiled
- [ ] No broken URLs
- [ ] No duplicate or conflicting data without explanation
- [ ] Cultural insights validated by native speakers
- [ ] Peer review completed
- [ ] Stakeholder approval received

---

**Document Version**: 1.0
**Last Updated**: [Date]
**Maintained By**: [Team/Individual]
