#!/usr/bin/env tsx

/**
 * Test AWS SES Connection
 * 
 * This script verifies that AWS credentials are correctly configured
 * and that the application can connect to AWS SES.
 * 
 * Usage:
 *   npm run test-ses-connection
 *   or
 *   npx tsx scripts/test-ses-connection.ts
 */

import { SESClient, GetAccountSendingEnabledCommand, GetSendQuotaCommand } from '@aws-sdk/client-ses';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

async function testSESConnection(): Promise<TestResult> {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  // Validate environment variables
  if (!region || !accessKeyId || !secretAccessKey) {
    return {
      success: false,
      message: 'Missing required environment variables',
      details: {
        AWS_REGION: region ? '✓ Set' : '✗ Missing',
        AWS_ACCESS_KEY_ID: accessKeyId ? '✓ Set' : '✗ Missing',
        AWS_SECRET_ACCESS_KEY: secretAccessKey ? '✓ Set' : '✗ Missing',
      },
    };
  }

  // Create SES client
  const client = new SESClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    // Test 1: Check if account sending is enabled
    console.log('Testing AWS SES connection...');
    const sendingEnabledCommand = new GetAccountSendingEnabledCommand({});
    await client.send(sendingEnabledCommand);
    console.log('✓ Account sending enabled check: SUCCESS');

    // Test 2: Get send quota
    const quotaCommand = new GetSendQuotaCommand({});
    const quotaResponse = await client.send(quotaCommand);
    console.log('✓ Send quota retrieval: SUCCESS');

    return {
      success: true,
      message: 'AWS SES connection successful',
      details: {
        region,
        maxSendRate: quotaResponse.MaxSendRate,
        max24HourSend: quotaResponse.Max24HourSend,
        sentLast24Hours: quotaResponse.SentLast24Hours,
        remainingQuota: (quotaResponse.Max24HourSend || 0) - (quotaResponse.SentLast24Hours || 0),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'AWS SES connection failed',
      details: {
        error: error.message,
        code: error.code,
        region,
        hint: getErrorHint(error),
      },
    };
  }
}

function getErrorHint(error: any): string {
  const code = error.code || error.name;

  switch (code) {
    case 'InvalidClientTokenId':
      return 'AWS Access Key ID is invalid. Check AWS_ACCESS_KEY_ID in .env';
    case 'SignatureDoesNotMatch':
      return 'AWS Secret Access Key is invalid. Check AWS_SECRET_ACCESS_KEY in .env';
    case 'UnrecognizedClientException':
      return 'AWS credentials are not recognized. Verify your IAM user exists and has correct permissions';
    case 'AccessDenied':
    case 'AccessDeniedException':
      return 'IAM user lacks required SES permissions. Check IAM policy includes ses:GetAccountSendingEnabled and ses:GetSendQuota';
    case 'InvalidParameterValue':
      return 'Invalid AWS region. Check AWS_REGION in .env (should be us-east-1 or similar)';
    case 'NetworkingError':
      return 'Network connection failed. Check your internet connection';
    default:
      return 'Check AWS credentials and IAM permissions';
  }
}

function printResult(result: TestResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('AWS SES Connection Test Results');
  console.log('='.repeat(60));

  if (result.success) {
    console.log('\n✅ SUCCESS: ' + result.message);
    console.log('\nConnection Details:');
    console.log(`  Region: ${result.details.region}`);
    console.log(`  Max Send Rate: ${result.details.maxSendRate} emails/second`);
    console.log(`  24-Hour Quota: ${result.details.max24HourSend} emails`);
    console.log(`  Sent (24h): ${result.details.sentLast24Hours} emails`);
    console.log(`  Remaining: ${result.details.remainingQuota} emails`);
    
    if (result.details.max24HourSend === 200) {
      console.log('\n⚠️  WARNING: Account is in SES Sandbox mode');
      console.log('   - Can only send to verified email addresses');
      console.log('   - Limited to 200 emails/day');
      console.log('   - Request production access in AWS SES Console');
    }
  } else {
    console.log('\n❌ FAILURE: ' + result.message);
    console.log('\nError Details:');
    if (result.details.error) {
      console.log(`  Error: ${result.details.error}`);
    }
    if (result.details.code) {
      console.log(`  Code: ${result.details.code}`);
    }
    if (result.details.region) {
      console.log(`  Region: ${result.details.region}`);
    }
    if (result.details.hint) {
      console.log(`\n💡 Hint: ${result.details.hint}`);
    }
    if (result.details.AWS_REGION !== undefined) {
      console.log('\nEnvironment Variables:');
      console.log(`  AWS_REGION: ${result.details.AWS_REGION}`);
      console.log(`  AWS_ACCESS_KEY_ID: ${result.details.AWS_ACCESS_KEY_ID}`);
      console.log(`  AWS_SECRET_ACCESS_KEY: ${result.details.AWS_SECRET_ACCESS_KEY}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\nFor setup instructions, see: backend/AWS_SES_SETUP.md');
  console.log('='.repeat(60) + '\n');
}

// Run the test
async function main() {
  try {
    const result = await testSESConnection();
    printResult(result);
    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
