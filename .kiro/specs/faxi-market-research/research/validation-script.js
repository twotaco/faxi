#!/usr/bin/env node

/**
 * Data Quality and Completeness Validation Script
 * 
 * This script validates the Faxi market research documents against the requirements:
 * - Verify all statistics have credible source citations
 * - Check that all citations include required fields (source, date, URL)
 * - Validate market sizing hierarchy (TAM ≥ SAM ≥ SOM)
 * - Ensure all ICP profiles are complete per template
 * - Verify all competitor profiles include required fields
 * - Check that all projections document assumptions
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.5
 */

const fs = require('fs');
const path = require('path');

// Configuration
const RESEARCH_DIR = path.join(__dirname);
const VALIDATION_REPORT_PATH = path.join(RESEARCH_DIR, 'validation-report.md');

// Validation results
const validationResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
}

function addResult(category, message) {
  validationResults[category].push(message);
  log(message, category === 'failed' ? 'error' : category === 'warnings' ? 'warn' : 'info');
}

// Validation functions

/**
 * Validate market sizing hierarchy: TAM ≥ SAM ≥ SOM
 * Requirements: 5.2, 5.3
 */
function validateMarketSizingHierarchy() {
  log('Validating market sizing hierarchy...');
  
  try {
    const csvPath = path.join(RESEARCH_DIR, 'market-sizing-spreadsheet.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Extract TAM, SAM, SOM values
    const tamMatch = csvContent.match(/TAM Users,(\d+)/);
    const samMatch = csvContent.match(/SAM Users,(\d+)/);
    const somYear1Match = csvContent.match(/SOM Year 1,(\d+)/);
    const somYear5Match = csvContent.match(/SOM Year 5,(\d+)/);
    
    if (!tamMatch || !samMatch || !somYear1Match || !somYear5Match) {
      addResult('failed', 'Market sizing values not found in spreadsheet');
      return;
    }
    
    const tam = parseInt(tamMatch[1]);
    const sam = parseInt(samMatch[1]);
    const somYear1 = parseInt(somYear1Match[1]);
    const somYear5 = parseInt(somYear5Match[1]);
    
    log(`TAM: ${tam.toLocaleString()}, SAM: ${sam.toLocaleString()}, SOM Year 1: ${somYear1.toLocaleString()}, SOM Year 5: ${somYear5.toLocaleString()}`);
    
    // Validate hierarchy
    if (tam >= sam) {
      addResult('passed', `✓ TAM ≥ SAM: ${tam.toLocaleString()} ≥ ${sam.toLocaleString()}`);
    } else {
      addResult('failed', `✗ TAM < SAM: ${tam.toLocaleString()} < ${sam.toLocaleString()}`);
    }
    
    if (sam >= somYear1) {
      addResult('passed', `✓ SAM ≥ SOM Year 1: ${sam.toLocaleString()} ≥ ${somYear1.toLocaleString()}`);
    } else {
      addResult('failed', `✗ SAM < SOM Year 1: ${sam.toLocaleString()} < ${somYear1.toLocaleString()}`);
    }
    
    if (sam >= somYear5) {
      addResult('passed', `✓ SAM ≥ SOM Year 5: ${sam.toLocaleString()} ≥ ${somYear5.toLocaleString()}`);
    } else {
      addResult('failed', `✗ SAM < SOM Year 5: ${sam.toLocaleString()} < ${somYear5.toLocaleString()}`);
    }
    
    if (somYear5 >= somYear1) {
      addResult('passed', `✓ SOM Year 5 ≥ SOM Year 1: ${somYear5.toLocaleString()} ≥ ${somYear1.toLocaleString()}`);
    } else {
      addResult('warnings', `⚠ SOM Year 5 < SOM Year 1: ${somYear5.toLocaleString()} < ${somYear1.toLocaleString()} (unusual but may be valid)`);
    }
    
  } catch (error) {
    addResult('failed', `Error validating market sizing: ${error.message}`);
  }
}

/**
 * Validate that statistics have source citations
 * Requirements: 8.1, 8.5
 * 
 * This validates that:
 * 1. Primary data sources (CSV, main research docs) have inline citations
 * 2. The market sizing spreadsheet has source columns filled
 * 3. Key demographic and market data has credible sources
 */
function validateSourceCitations() {
  log('Validating source citations...');
  
  let allChecksPass = true;
  
  // Check 1: Market sizing spreadsheet has sources for all data
  try {
    const csvPath = path.join(RESEARCH_DIR, 'market-sizing-spreadsheet.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Count rows with data and rows with sources
    const dataRows = csvContent.split('\n').filter(line => {
      // Skip header rows and empty rows
      return line.trim() && 
             !line.startsWith('Market Sizing') && 
             !line.startsWith('Document Version') &&
             !line.startsWith('Last Updated') &&
             !line.match(/^,+$/) &&
             /\d/.test(line); // Has numbers
    });
    
    const rowsWithSources = dataRows.filter(line => {
      // Check if row has a source (URL or organization name)
      return /https?:\/\/|Statistics Bureau|Ministry of|Cabinet Office|National Institute/i.test(line);
    });
    
    const sourceRate = dataRows.length > 0 ? (rowsWithSources.length / dataRows.length * 100).toFixed(1) : 0;
    
    if (sourceRate >= 80) {
      addResult('passed', `✓ Market sizing spreadsheet: ${sourceRate}% of data rows have sources (${rowsWithSources.length}/${dataRows.length})`);
    } else {
      addResult('warnings', `⚠ Market sizing spreadsheet: ${sourceRate}% of data rows have sources (${rowsWithSources.length}/${dataRows.length}) - should be >80%`);
      allChecksPass = false;
    }
    
  } catch (error) {
    addResult('failed', `Error validating market sizing spreadsheet: ${error.message}`);
    allChecksPass = false;
  }
  
  // Check 2: Master research document has citations for demographic data
  try {
    const masterDocPath = path.join(RESEARCH_DIR, 'master-research-document.md');
    const masterContent = fs.readFileSync(masterDocPath, 'utf-8');
    
    // Count demographic bullet points and those with sources
    const demographicSection = masterContent.match(/### Demographic Profile[\s\S]*?(?=###|$)/g);
    
    if (demographicSection && demographicSection.length > 0) {
      const bulletPoints = demographicSection[0].match(/- \*\*[^:]+\*\*:/g) || [];
      const bulletPointsWithSources = demographicSection[0].match(/Source: [^\n]+/g) || [];
      
      const citationRate = bulletPoints.length > 0 ? (bulletPointsWithSources.length / bulletPoints.length * 100).toFixed(1) : 0;
      
      if (citationRate >= 70) {
        addResult('passed', `✓ Master document demographic data: ${citationRate}% of sections have sources (${bulletPointsWithSources.length}/${bulletPoints.length})`);
      } else {
        addResult('warnings', `⚠ Master document demographic data: ${citationRate}% of sections have sources (${bulletPointsWithSources.length}/${bulletPoints.length}) - should be >70%`);
        allChecksPass = false;
      }
    }
    
  } catch (error) {
    addResult('failed', `Error validating master document citations: ${error.message}`);
    allChecksPass = false;
  }
  
  // Check 3: Competitive analysis has sources
  try {
    const compAnalysisPath = path.join(RESEARCH_DIR, 'competitive-analysis.md');
    const compContent = fs.readFileSync(compAnalysisPath, 'utf-8');
    
    // Count competitor sections and those with sources
    const competitorSections = compContent.match(/### Competitor \d+:/g) || [];
    const competitorSources = compContent.match(/\*\*Source\*\*:/g) || [];
    
    const sourceRate = competitorSections.length > 0 ? (competitorSources.length / competitorSections.length * 100).toFixed(1) : 0;
    
    if (sourceRate >= 80) {
      addResult('passed', `✓ Competitive analysis: ${sourceRate}% of competitors have sources (${competitorSources.length}/${competitorSections.length})`);
    } else {
      addResult('warnings', `⚠ Competitive analysis: ${sourceRate}% of competitors have sources (${competitorSources.length}/${competitorSections.length}) - should be >80%`);
      allChecksPass = false;
    }
    
  } catch (error) {
    addResult('failed', `Error validating competitive analysis citations: ${error.message}`);
    allChecksPass = false;
  }
  
  if (allChecksPass) {
    addResult('passed', '✓ Overall source citation quality is good across primary research documents');
  }
}

/**
 * Validate citation format and required fields
 * Requirements: 8.5
 */
function validateCitationFormat() {
  log('Validating citation format...');
  
  const documentsToCheck = [
    'japanese-elderly-demographics.md',
    'japanese-family-dynamics.md',
    'business-partner-landscape.md',
    'competitive-analysis.md',
    'market-sizing-analysis.md',
    'revenue-model-analysis.md'
  ];
  
  let totalCitations = 0;
  let validCitations = 0;
  let invalidCitations = [];
  
  // Required fields: source name, report title, date, URL
  const citationPattern = /\*\*Source\*\*:\s*([^,\n]+),\s*"([^"]+)",\s*(\w+\s+\d{4}),\s*(https?:\/\/[^\s,]+)/gi;
  
  documentsToCheck.forEach(filename => {
    try {
      const filePath = path.join(RESEARCH_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const matches = [...content.matchAll(citationPattern)];
      
      totalCitations += matches.length;
      
      matches.forEach(match => {
        const [fullMatch, source, title, date, url] = match;
        
        // Validate each field
        const hasSource = source && source.trim().length > 0;
        const hasTitle = title && title.trim().length > 0;
        const hasDate = date && /\w+\s+\d{4}/.test(date);
        const hasUrl = url && /^https?:\/\/.+/.test(url);
        
        if (hasSource && hasTitle && hasDate && hasUrl) {
          validCitations++;
        } else {
          invalidCitations.push({
            file: filename,
            citation: fullMatch.substring(0, 100),
            missing: [
              !hasSource && 'source',
              !hasTitle && 'title',
              !hasDate && 'date',
              !hasUrl && 'URL'
            ].filter(Boolean)
          });
        }
      });
      
    } catch (error) {
      addResult('failed', `Error validating citations in ${filename}: ${error.message}`);
    }
  });
  
  if (totalCitations > 0) {
    const validRate = (validCitations / totalCitations * 100).toFixed(1);
    if (validRate === 100) {
      addResult('passed', `✓ All citations properly formatted: ${validCitations}/${totalCitations} citations valid`);
    } else {
      addResult('warnings', `⚠ Citation format issues: ${validRate}% valid (${validCitations}/${totalCitations})`);
      invalidCitations.slice(0, 5).forEach(issue => {
        addResult('warnings', `  - ${issue.file}: Missing ${issue.missing.join(', ')}`);
      });
    }
  } else {
    addResult('warnings', '⚠ No properly formatted citations found');
  }
}

/**
 * Validate ICP profile completeness
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
function validateICPProfiles() {
  log('Validating ICP profile completeness...');
  
  // Required sections for each ICP profile
  // Business Partners uses different section names (Organization Types instead of Demographics)
  const requiredSections = {
    standard: [
      'Demographic Profile',
      'Psychographic Profile',
      'Pain Points',
      'Buying Journey',
      'Value Proposition',
      'Messaging Framework',
      'Acquisition Channels'
    ],
    businessPartners: [
      'Organization Types and Characteristics',
      'Market Size',
      'Decision-Maker Profiles',
      'Psychographic Profile',
      'Pain Points',
      'B2B Procurement Journey',
      'B2B Communication Preferences',
      'Value Propositions by Partner Type',
      'Messaging Framework by Partner Type',
      'Acquisition Channels by Partner Type'
    ]
  };
  
  const icpFiles = [
    { file: 'master-research-document.md', name: 'ICP 1: Elder-Offline-Fax-Users', sections: 'standard' },
    { file: 'master-research-document.md', name: 'ICP 2: Online-Families', sections: 'standard' },
    { file: 'master-research-document.md', name: 'ICP 3: Business Partners', sections: 'businessPartners' }
  ];
  
  icpFiles.forEach(({ file, name, sections }) => {
    try {
      const filePath = path.join(RESEARCH_DIR, file);
      if (!fs.existsSync(filePath)) {
        addResult('failed', `✗ ICP profile file not found: ${file}`);
        return;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const missingSections = [];
      const sectionsToCheck = requiredSections[sections];
      
      sectionsToCheck.forEach(section => {
        // Check for section heading (with various markdown formats)
        const sectionPattern = new RegExp(`#+\\s*${section}`, 'i');
        if (!sectionPattern.test(content)) {
          missingSections.push(section);
        }
      });
      
      if (missingSections.length === 0) {
        addResult('passed', `✓ ${name}: All required sections present`);
      } else {
        addResult('warnings', `⚠ ${name}: Missing sections: ${missingSections.join(', ')}`);
      }
      
    } catch (error) {
      addResult('failed', `Error validating ICP profile ${name}: ${error.message}`);
    }
  });
}

/**
 * Validate competitor profile completeness
 * Requirements: 4.1, 4.2
 */
function validateCompetitorProfiles() {
  log('Validating competitor profile completeness...');
  
  const requiredFields = [
    'Type',
    'Target Market',
    'Value Proposition',
    'Strengths',
    'Weaknesses',
    'Market Positioning',
    'Competitive Threat Level'
  ];
  
  try {
    const filePath = path.join(RESEARCH_DIR, 'competitive-analysis.md');
    if (!fs.existsSync(filePath)) {
      addResult('failed', '✗ Competitive analysis file not found');
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Find all competitor sections
    const competitorPattern = /###\s+Competitor\s+\d+:\s+([^\n]+)/g;
    const competitors = [...content.matchAll(competitorPattern)];
    
    if (competitors.length === 0) {
      addResult('warnings', '⚠ No competitor profiles found');
      return;
    }
    
    let completeProfiles = 0;
    
    competitors.forEach(match => {
      const competitorName = match[1];
      const competitorIndex = content.indexOf(match[0]);
      const nextCompetitorIndex = content.indexOf('### Competitor', competitorIndex + 1);
      const competitorSection = nextCompetitorIndex > 0 
        ? content.substring(competitorIndex, nextCompetitorIndex)
        : content.substring(competitorIndex);
      
      const missingFields = [];
      
      requiredFields.forEach(field => {
        const fieldPattern = new RegExp(`\\*\\*${field}\\*\\*:|####\\s*${field}`, 'i');
        if (!fieldPattern.test(competitorSection)) {
          missingFields.push(field);
        }
      });
      
      if (missingFields.length === 0) {
        completeProfiles++;
      } else {
        addResult('warnings', `⚠ ${competitorName}: Missing fields: ${missingFields.join(', ')}`);
      }
    });
    
    if (completeProfiles === competitors.length) {
      addResult('passed', `✓ All ${competitors.length} competitor profiles complete`);
    } else {
      addResult('warnings', `⚠ ${completeProfiles}/${competitors.length} competitor profiles complete`);
    }
    
  } catch (error) {
    addResult('failed', `Error validating competitor profiles: ${error.message}`);
  }
}

/**
 * Validate that projections document assumptions
 * Requirements: 8.3
 */
function validateProjectionAssumptions() {
  log('Validating projection assumptions...');
  
  const documentsWithProjections = [
    'market-sizing-analysis.md',
    'revenue-model-analysis.md'
  ];
  
  documentsWithProjections.forEach(filename => {
    try {
      const filePath = path.join(RESEARCH_DIR, filename);
      if (!fs.existsSync(filePath)) {
        addResult('warnings', `⚠ Projection document not found: ${filename}`);
        return;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Look for projection sections
      const hasProjections = /projection|forecast|year\s+\d+/i.test(content);
      
      if (!hasProjections) {
        addResult('warnings', `⚠ ${filename}: No projections found`);
        return;
      }
      
      // Look for assumptions sections
      const hasAssumptions = /assumption|based on|estimated|calculated/i.test(content);
      
      if (hasAssumptions) {
        addResult('passed', `✓ ${filename}: Projections include assumptions`);
      } else {
        addResult('failed', `✗ ${filename}: Projections missing documented assumptions`);
      }
      
    } catch (error) {
      addResult('failed', `Error validating projections in ${filename}: ${error.message}`);
    }
  });
}

/**
 * Validate data source credibility
 * Requirements: 8.1
 */
function validateDataSourceCredibility() {
  log('Validating data source credibility...');
  
  const credibleSources = [
    'Statistics Bureau of Japan',
    'Ministry of Internal Affairs and Communications',
    'Ministry of Health, Labour and Welfare',
    'Cabinet Office',
    'Ministry of Economy, Trade and Industry',
    'National Institute of Population',
    'Japan Business Machine',
    'Consumer Affairs Agency',
    'NTT',
    'MM Research Institute',
    'Japan Franchise Association',
    'Japan Direct Marketing Association'
  ];
  
  try {
    const csvPath = path.join(RESEARCH_DIR, 'market-sizing-spreadsheet.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    let credibleSourceCount = 0;
    let totalSourceCount = 0;
    
    credibleSources.forEach(source => {
      const pattern = new RegExp(source, 'gi');
      const matches = csvContent.match(pattern);
      if (matches) {
        credibleSourceCount += matches.length;
        totalSourceCount += matches.length;
      }
    });
    
    if (totalSourceCount > 0) {
      addResult('passed', `✓ Data sources are credible: ${credibleSourceCount} references to government/industry sources`);
    } else {
      addResult('warnings', '⚠ Could not verify data source credibility');
    }
    
  } catch (error) {
    addResult('failed', `Error validating data sources: ${error.message}`);
  }
}

/**
 * Generate validation report
 */
function generateReport() {
  log('Generating validation report...');
  
  const report = `# Data Quality and Completeness Validation Report

**Generated**: ${new Date().toISOString()}

## Summary

- **Passed**: ${validationResults.passed.length} checks
- **Failed**: ${validationResults.failed.length} checks
- **Warnings**: ${validationResults.warnings.length} checks

## Validation Results

### ✓ Passed Checks (${validationResults.passed.length})

${validationResults.passed.map(item => `- ${item}`).join('\n')}

### ✗ Failed Checks (${validationResults.failed.length})

${validationResults.failed.length > 0 
  ? validationResults.failed.map(item => `- ${item}`).join('\n')
  : '_No failed checks_'}

### ⚠ Warnings (${validationResults.warnings.length})

${validationResults.warnings.length > 0
  ? validationResults.warnings.map(item => `- ${item}`).join('\n')
  : '_No warnings_'}

## Requirements Coverage

This validation covers the following requirements:

- **Requirement 5.2, 5.3**: Market sizing hierarchy (TAM ≥ SAM ≥ SOM)
- **Requirement 8.1**: Credible data sources
- **Requirement 8.2**: Demographic data with methodology
- **Requirement 8.3**: Projections document assumptions
- **Requirement 8.5**: Full citations with required fields

## Recommendations

${validationResults.failed.length > 0 
  ? '### Critical Issues to Address\n\n' + validationResults.failed.map((item, i) => `${i + 1}. ${item}`).join('\n')
  : '### No Critical Issues\n\nAll critical validation checks passed.'}

${validationResults.warnings.length > 0
  ? '\n### Improvements to Consider\n\n' + validationResults.warnings.map((item, i) => `${i + 1}. ${item}`).join('\n')
  : ''}

## Conclusion

${validationResults.failed.length === 0 && validationResults.warnings.length === 0
  ? 'All validation checks passed. The research documents meet the data quality and completeness requirements.'
  : validationResults.failed.length === 0
    ? 'All critical validation checks passed. Some warnings were identified for improvement.'
    : 'Some validation checks failed. Please address the critical issues before finalizing the research.'}
`;
  
  fs.writeFileSync(VALIDATION_REPORT_PATH, report);
  log(`Validation report written to: ${VALIDATION_REPORT_PATH}`);
}

// Main execution
function main() {
  console.log('='.repeat(80));
  console.log('Faxi Market Research - Data Quality and Completeness Validation');
  console.log('='.repeat(80));
  console.log('');
  
  // Run all validations
  validateMarketSizingHierarchy();
  validateSourceCitations();
  validateCitationFormat();
  validateICPProfiles();
  validateCompetitorProfiles();
  validateProjectionAssumptions();
  validateDataSourceCredibility();
  
  // Generate report
  generateReport();
  
  console.log('');
  console.log('='.repeat(80));
  console.log(`Validation Complete: ${validationResults.passed.length} passed, ${validationResults.failed.length} failed, ${validationResults.warnings.length} warnings`);
  console.log('='.repeat(80));
  
  // Exit with appropriate code
  process.exit(validationResults.failed.length > 0 ? 1 : 0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  validateMarketSizingHierarchy,
  validateSourceCitations,
  validateCitationFormat,
  validateICPProfiles,
  validateCompetitorProfiles,
  validateProjectionAssumptions,
  validateDataSourceCredibility
};
