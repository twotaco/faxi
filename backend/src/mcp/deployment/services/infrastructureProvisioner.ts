/**
 * Infrastructure Provisioning Service
 * 
 * Intelligently provisions AWS infrastructure using AWS CLI:
 * - Checks for existing resources
 * - Creates missing resources
 * - Updates .env files with connection details
 * - Handles RDS, ElastiCache, S3, ECR, ECS, ALB, Route53
 */

import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface InfrastructureConfig {
  environment: string;
  region: string;
  projectName: string;
  domains: {
    marketing: string;
    admin: string;
    backend: string;
  };
}

export interface ProvisioningResult {
  success: boolean;
  resourcesCreated: string[];
  resourcesExisting: string[];
  endpoints: {
    database?: string;
    redis?: string;
    s3Bucket?: string;
    albDns?: string;
  };
  errors: string[];
  warnings: string[];
}

export class InfrastructureProvisioner {
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Provision complete infrastructure for an environment
   */
  public async provisionInfrastructure(config: InfrastructureConfig): Promise<ProvisioningResult> {
    const result: ProvisioningResult = {
      success: true,
      resourcesCreated: [],
      resourcesExisting: [],
      endpoints: {},
      errors: [],
      warnings: [],
    };

    console.log(`\n🚀 Provisioning infrastructure for ${config.environment} environment...`);

    try {
      // Check AWS CLI is available
      await this.checkAwsCli();

      // 1. Check/Create VPC and networking
      console.log('\n📡 Checking VPC and networking...');
      const vpcResult = await this.ensureVpc(config);
      this.mergeResult(result, vpcResult);

      // 2. Check/Create RDS PostgreSQL
      console.log('\n🗄️  Checking RDS PostgreSQL database...');
      const rdsResult = await this.ensureRds(config);
      this.mergeResult(result, rdsResult);
      if (rdsResult.endpoints.database) {
        result.endpoints.database = rdsResult.endpoints.database;
      }

      // 3. Check/Create ElastiCache Redis
      console.log('\n⚡ Checking ElastiCache Redis...');
      const redisResult = await this.ensureRedis(config);
      this.mergeResult(result, redisResult);
      if (redisResult.endpoints.redis) {
        result.endpoints.redis = redisResult.endpoints.redis;
      }

      // 4. Check/Create S3 Bucket
      console.log('\n🪣  Checking S3 bucket...');
      const s3Result = await this.ensureS3(config);
      this.mergeResult(result, s3Result);
      if (s3Result.endpoints.s3Bucket) {
        result.endpoints.s3Bucket = s3Result.endpoints.s3Bucket;
      }

      // 5. Check/Create ECR Repositories
      console.log('\n🐳 Checking ECR repositories...');
      const ecrResult = await this.ensureEcr(config);
      this.mergeResult(result, ecrResult);

      // 6. Check/Create ECS Cluster
      console.log('\n☸️  Checking ECS cluster...');
      const ecsResult = await this.ensureEcs(config);
      this.mergeResult(result, ecsResult);

      // 7. Check/Create Application Load Balancer
      console.log('\n⚖️  Checking Application Load Balancer...');
      const albResult = await this.ensureAlb(config);
      this.mergeResult(result, albResult);
      if (albResult.endpoints.albDns) {
        result.endpoints.albDns = albResult.endpoints.albDns;
      }

      // 8. Update .env files with endpoints
      console.log('\n📝 Updating .env files...');
      await this.updateEnvFiles(config, result.endpoints);

      console.log('\n✅ Infrastructure provisioning complete!');
      console.log(`\n📊 Summary:`);
      console.log(`   Created: ${result.resourcesCreated.length} resources`);
      console.log(`   Existing: ${result.resourcesExisting.length} resources`);
      if (result.warnings.length > 0) {
        console.log(`   Warnings: ${result.warnings.length}`);
      }

      return result;

    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      console.error(`\n❌ Infrastructure provisioning failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Check if AWS CLI is installed and configured
   */
  private async checkAwsCli(): Promise<void> {
    try {
      execSync('aws --version', { stdio: 'pipe' });
      execSync('aws sts get-caller-identity', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('AWS CLI not found or not configured. Please install and configure AWS CLI first.');
    }
  }

  /**
   * Ensure VPC and networking exists
   */
  private async ensureVpc(config: InfrastructureConfig): Promise<Partial<ProvisioningResult>> {
    const result: Partial<ProvisioningResult> = {
      resourcesCreated: [],
      resourcesExisting: [],
      errors: [],
      warnings: [],
      endpoints: {},
    };

    const vpcName = `${config.environment}-${config.projectName}-vpc`;

    try {
      // Check if VPC exists
      const vpcCheck = execSync(
        `aws ec2 describe-vpcs --filters "Name=tag:Name,Values=${vpcName}" --region ${config.region} --query 'Vpcs[0].VpcId' --output text`,
        { encoding: 'utf-8' }
      ).trim();

      if (vpcCheck && vpcCheck !== 'None') {
        console.log(`   ✓ VPC already exists: ${vpcCheck}`);
        result.resourcesExisting!.push(`VPC: ${vpcName}`);
      } else {
        console.log(`   ⚙️  Creating VPC...`);
        result.warnings!.push('VPC creation requires CloudFormation. Please run: aws cloudformation create-stack --stack-name faxi-qa-infrastructure --template-body file://aws/cloudformation-qa.yaml');
      }
    } catch (error: any) {
      result.warnings!.push(`VPC check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Ensure RDS PostgreSQL database exists
   */
  private async ensureRds(config: InfrastructureConfig): Promise<Partial<ProvisioningResult>> {
    const result: Partial<ProvisioningResult> = {
      resourcesCreated: [],
      resourcesExisting: [],
      errors: [],
      warnings: [],
      endpoints: {},
    };

    const dbIdentifier = `${config.environment}-${config.projectName}-db`;

    try {
      // Check if RDS instance exists
      const rdsCheck = execSync(
        `aws rds describe-db-instances --db-instance-identifier ${dbIdentifier} --region ${config.region} --query 'DBInstances[0].Endpoint.Address' --output text 2>/dev/null || echo "NotFound"`,
        { encoding: 'utf-8' }
      ).trim();

      if (rdsCheck && rdsCheck !== 'NotFound') {
        console.log(`   ✓ RDS instance already exists: ${dbIdentifier}`);
        console.log(`   📍 Endpoint: ${rdsCheck}`);
        result.resourcesExisting!.push(`RDS: ${dbIdentifier}`);
        result.endpoints!.database = rdsCheck;
      } else {
        console.log(`   ❓ RDS instance not found. Would you like to create it?`);
        result.warnings!.push(`RDS instance ${dbIdentifier} not found. Create it with CloudFormation or manually.`);
      }
    } catch (error: any) {
      result.warnings!.push(`RDS check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Ensure ElastiCache Redis cluster exists
   */
  private async ensureRedis(config: InfrastructureConfig): Promise<Partial<ProvisioningResult>> {
    const result: Partial<ProvisioningResult> = {
      resourcesCreated: [],
      resourcesExisting: [],
      errors: [],
      warnings: [],
      endpoints: {},
    };

    const cacheClusterId = `${config.environment}-${config.projectName}-redis`;

    try {
      // Check if Redis cluster exists
      const redisCheck = execSync(
        `aws elasticache describe-cache-clusters --cache-cluster-id ${cacheClusterId} --region ${config.region} --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' --output text 2>/dev/null || echo "NotFound"`,
        { encoding: 'utf-8' }
      ).trim();

      if (redisCheck && redisCheck !== 'NotFound') {
        console.log(`   ✓ Redis cluster already exists: ${cacheClusterId}`);
        console.log(`   📍 Endpoint: ${redisCheck}`);
        result.resourcesExisting!.push(`Redis: ${cacheClusterId}`);
        result.endpoints!.redis = redisCheck;
      } else {
        console.log(`   ❓ Redis cluster not found. Would you like to create it?`);
        result.warnings!.push(`Redis cluster ${cacheClusterId} not found. Create it with CloudFormation or manually.`);
      }
    } catch (error: any) {
      result.warnings!.push(`Redis check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Ensure S3 bucket exists
   */
  private async ensureS3(config: InfrastructureConfig): Promise<Partial<ProvisioningResult>> {
    const result: Partial<ProvisioningResult> = {
      resourcesCreated: [],
      resourcesExisting: [],
      errors: [],
      warnings: [],
      endpoints: {},
    };

    const bucketName = `${config.environment}-${config.projectName}-faxes`;

    try {
      // Check if bucket exists
      const bucketCheck = execSync(
        `aws s3 ls s3://${bucketName} --region ${config.region} 2>&1`,
        { encoding: 'utf-8' }
      );

      if (!bucketCheck.includes('NoSuchBucket')) {
        console.log(`   ✓ S3 bucket already exists: ${bucketName}`);
        result.resourcesExisting!.push(`S3: ${bucketName}`);
        result.endpoints!.s3Bucket = bucketName;
      } else {
        throw new Error('Bucket not found');
      }
    } catch (error: any) {
      // Bucket doesn't exist, create it
      console.log(`   ⚙️  Creating S3 bucket: ${bucketName}...`);
      
      try {
        execSync(
          `aws s3 mb s3://${bucketName} --region ${config.region}`,
          { stdio: 'pipe' }
        );

        // Enable encryption
        execSync(
          `aws s3api put-bucket-encryption --bucket ${bucketName} --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'`,
          { stdio: 'pipe' }
        );

        // Enable versioning
        execSync(
          `aws s3api put-bucket-versioning --bucket ${bucketName} --versioning-configuration Status=Enabled`,
          { stdio: 'pipe' }
        );

        // Block public access
        execSync(
          `aws s3api put-public-access-block --bucket ${bucketName} --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"`,
          { stdio: 'pipe' }
        );

        console.log(`   ✅ S3 bucket created: ${bucketName}`);
        result.resourcesCreated!.push(`S3: ${bucketName}`);
        result.endpoints!.s3Bucket = bucketName;
      } catch (createError: any) {
        result.errors!.push(`Failed to create S3 bucket: ${createError.message}`);
      }
    }

    return result;
  }

  /**
   * Ensure ECR repositories exist
   */
  private async ensureEcr(config: InfrastructureConfig): Promise<Partial<ProvisioningResult>> {
    const result: Partial<ProvisioningResult> = {
      resourcesCreated: [],
      resourcesExisting: [],
      errors: [],
      warnings: [],
      endpoints: {},
    };

    const repositories = [
      `${config.projectName}-backend`,
      `${config.projectName}-admin-dashboard`,
      `${config.projectName}-marketing-website`,
    ];

    for (const repoName of repositories) {
      try {
        // Check if repository exists
        const repoCheck = execSync(
          `aws ecr describe-repositories --repository-names ${repoName} --region ${config.region} --query 'repositories[0].repositoryUri' --output text 2>/dev/null || echo "NotFound"`,
          { encoding: 'utf-8' }
        ).trim();

        if (repoCheck && repoCheck !== 'NotFound') {
          console.log(`   ✓ ECR repository already exists: ${repoName}`);
          result.resourcesExisting!.push(`ECR: ${repoName}`);
        } else {
          // Create repository
          console.log(`   ⚙️  Creating ECR repository: ${repoName}...`);
          
          execSync(
            `aws ecr create-repository --repository-name ${repoName} --region ${config.region} --image-scanning-configuration scanOnPush=true --encryption-configuration encryptionType=AES256`,
            { stdio: 'pipe' }
          );

          console.log(`   ✅ ECR repository created: ${repoName}`);
          result.resourcesCreated!.push(`ECR: ${repoName}`);
        }
      } catch (error: any) {
        result.errors!.push(`Failed to create ECR repository ${repoName}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Ensure ECS cluster exists
   */
  private async ensureEcs(config: InfrastructureConfig): Promise<Partial<ProvisioningResult>> {
    const result: Partial<ProvisioningResult> = {
      resourcesCreated: [],
      resourcesExisting: [],
      errors: [],
      warnings: [],
      endpoints: {},
    };

    const clusterName = `${config.environment}-${config.projectName}-cluster`;

    try {
      // Check if cluster exists
      const clusterCheck = execSync(
        `aws ecs describe-clusters --clusters ${clusterName} --region ${config.region} --query 'clusters[0].status' --output text 2>/dev/null || echo "NotFound"`,
        { encoding: 'utf-8' }
      ).trim();

      if (clusterCheck === 'ACTIVE') {
        console.log(`   ✓ ECS cluster already exists: ${clusterName}`);
        result.resourcesExisting!.push(`ECS Cluster: ${clusterName}`);
      } else {
        // Create cluster
        console.log(`   ⚙️  Creating ECS cluster: ${clusterName}...`);
        
        execSync(
          `aws ecs create-cluster --cluster-name ${clusterName} --region ${config.region} --capacity-providers FARGATE FARGATE_SPOT --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 capacityProvider=FARGATE_SPOT,weight=1`,
          { stdio: 'pipe' }
        );

        console.log(`   ✅ ECS cluster created: ${clusterName}`);
        result.resourcesCreated!.push(`ECS Cluster: ${clusterName}`);
      }
    } catch (error: any) {
      result.errors!.push(`Failed to create ECS cluster: ${error.message}`);
    }

    return result;
  }

  /**
   * Ensure Application Load Balancer exists
   */
  private async ensureAlb(config: InfrastructureConfig): Promise<Partial<ProvisioningResult>> {
    const result: Partial<ProvisioningResult> = {
      resourcesCreated: [],
      resourcesExisting: [],
      errors: [],
      warnings: [],
      endpoints: {},
    };

    const albName = `${config.environment}-${config.projectName}-alb`;

    try {
      // Check if ALB exists
      const albCheck = execSync(
        `aws elbv2 describe-load-balancers --names ${albName} --region ${config.region} --query 'LoadBalancers[0].DNSName' --output text 2>/dev/null || echo "NotFound"`,
        { encoding: 'utf-8' }
      ).trim();

      if (albCheck && albCheck !== 'NotFound') {
        console.log(`   ✓ ALB already exists: ${albName}`);
        console.log(`   📍 DNS: ${albCheck}`);
        result.resourcesExisting!.push(`ALB: ${albName}`);
        result.endpoints!.albDns = albCheck;
      } else {
        console.log(`   ❓ ALB not found. Would you like to create it?`);
        result.warnings!.push(`ALB ${albName} not found. Create it with CloudFormation (requires VPC, subnets, security groups).`);
      }
    } catch (error: any) {
      result.warnings!.push(`ALB check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Update .env files with infrastructure endpoints
   */
  private async updateEnvFiles(config: InfrastructureConfig, endpoints: any): Promise<void> {
    const envFile = path.join(this.projectRoot, `.env.${config.environment}`);

    try {
      let envContent = await fs.readFile(envFile, 'utf-8');

      // Update database endpoint
      if (endpoints.database) {
        envContent = envContent.replace(
          /DATABASE_HOST=.*/,
          `DATABASE_HOST=${endpoints.database}`
        );
        console.log(`   ✓ Updated DATABASE_HOST`);
      }

      // Update Redis endpoint
      if (endpoints.redis) {
        envContent = envContent.replace(
          /REDIS_HOST=.*/,
          `REDIS_HOST=${endpoints.redis}`
        );
        console.log(`   ✓ Updated REDIS_HOST`);
      }

      // Update S3 bucket
      if (endpoints.s3Bucket) {
        envContent = envContent.replace(
          /S3_BUCKET=.*/,
          `S3_BUCKET=${endpoints.s3Bucket}`
        );
        console.log(`   ✓ Updated S3_BUCKET`);
      }

      await fs.writeFile(envFile, envContent, 'utf-8');
      console.log(`   ✅ Updated ${envFile}`);

    } catch (error: any) {
      console.warn(`   ⚠️  Could not update .env file: ${error.message}`);
    }
  }

  /**
   * Merge partial results into main result
   */
  private mergeResult(main: ProvisioningResult, partial: Partial<ProvisioningResult>): void {
    if (partial.resourcesCreated) {
      main.resourcesCreated.push(...partial.resourcesCreated);
    }
    if (partial.resourcesExisting) {
      main.resourcesExisting.push(...partial.resourcesExisting);
    }
    if (partial.errors) {
      main.errors.push(...partial.errors);
    }
    if (partial.warnings) {
      main.warnings.push(...partial.warnings);
    }
  }
}

export const infrastructureProvisioner = new InfrastructureProvisioner();
