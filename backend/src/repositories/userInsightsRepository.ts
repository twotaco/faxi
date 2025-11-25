import { db } from '../database/connection.js';
import { UserInsights } from '../prompts/schemas/base.js';

export interface UserInsightsProfile {
  userId: string;
  profileData: any; // Full JSONB profile
  lastUpdated: Date;
  createdAt: Date;
  version: number;
  
  // Extracted fields
  ageRange?: string;
  gender?: string;
  region?: string;
  householdType?: string;
  digitalExclusionScore?: number;
  
  // Metrics
  totalInteractions: number;
  lastInteractionAt?: Date;
}

export interface InsightHistoryEntry {
  id: string;
  userId: string;
  faxJobId?: string;
  insightType: string;
  insightCategory?: string;
  insightData: any;
  confidenceScore?: number;
  detectedAt: Date;
  previousValue?: any;
  newValue?: any;
}

export interface AggregateInsight {
  id: string;
  region?: string;
  ageRange?: string;
  householdType?: string;
  insightCategory: string;
  aggregateData: any;
  periodStart: Date;
  periodEnd: Date;
  sampleSize: number;
  createdAt: Date;
  updatedAt: Date;
}

class UserInsightsRepository {
  /**
   * Get user insights profile
   */
  async findByUserId(userId: string): Promise<UserInsightsProfile | null> {
    const result = await db.query<UserInsightsProfile>(
      `SELECT 
        user_id as "userId",
        profile_data as "profileData",
        last_updated as "lastUpdated",
        created_at as "createdAt",
        version,
        age_range as "ageRange",
        gender,
        region,
        household_type as "householdType",
        digital_exclusion_score as "digitalExclusionScore",
        total_interactions as "totalInteractions",
        last_interaction_at as "lastInteractionAt"
      FROM user_insights
      WHERE user_id = $1`,
      [userId]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Create or update user insights profile
   */
  async upsert(userId: string, profileData: any): Promise<UserInsightsProfile> {
    // Extract fields for fast querying
    const ageRange = profileData.demographics?.ageRangeInferred;
    const gender = profileData.demographics?.genderInferred;
    const region = profileData.demographics?.regionInferred;
    const householdType = profileData.demographics?.householdTypeInferred;
    const digitalExclusionScore = profileData.digitalProfile?.digitalExclusionScore;
    
    const result = await db.query<UserInsightsProfile>(
      `INSERT INTO user_insights (
        user_id, profile_data, age_range, gender, region, 
        household_type, digital_exclusion_score, total_interactions, last_interaction_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        profile_data = $2,
        age_range = $3,
        gender = $4,
        region = $5,
        household_type = $6,
        digital_exclusion_score = $7,
        total_interactions = user_insights.total_interactions + 1,
        last_interaction_at = NOW(),
        last_updated = NOW(),
        version = user_insights.version + 1
      RETURNING 
        user_id as "userId",
        profile_data as "profileData",
        last_updated as "lastUpdated",
        created_at as "createdAt",
        version,
        age_range as "ageRange",
        gender,
        region,
        household_type as "householdType",
        digital_exclusion_score as "digitalExclusionScore",
        total_interactions as "totalInteractions",
        last_interaction_at as "lastInteractionAt"`,
      [userId, JSON.stringify(profileData), ageRange, gender, region, householdType, digitalExclusionScore]
    );
    
    return result.rows[0];
  }

  /**
   * Record insight in history
   */
  async recordInsight(
    userId: string,
    faxJobId: string | undefined,
    insightType: string,
    insightCategory: string | undefined,
    insightData: any,
    confidenceScore: number | undefined,
    previousValue?: any,
    newValue?: any
  ): Promise<InsightHistoryEntry> {
    const result = await db.query<InsightHistoryEntry>(
      `INSERT INTO insights_history (
        user_id, fax_job_id, insight_type, insight_category,
        insight_data, confidence_score, previous_value, new_value
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id,
        user_id as "userId",
        fax_job_id as "faxJobId",
        insight_type as "insightType",
        insight_category as "insightCategory",
        insight_data as "insightData",
        confidence_score as "confidenceScore",
        detected_at as "detectedAt",
        previous_value as "previousValue",
        new_value as "newValue"`,
      [
        userId,
        faxJobId || null,
        insightType,
        insightCategory || null,
        JSON.stringify(insightData),
        confidenceScore || null,
        previousValue ? JSON.stringify(previousValue) : null,
        newValue ? JSON.stringify(newValue) : null
      ]
    );
    
    return result.rows[0];
  }

  /**
   * Get insight history for user
   */
  async getHistory(
    userId: string,
    limit: number = 50,
    insightType?: string
  ): Promise<InsightHistoryEntry[]> {
    const query = insightType
      ? `SELECT 
          id,
          user_id as "userId",
          fax_job_id as "faxJobId",
          insight_type as "insightType",
          insight_category as "insightCategory",
          insight_data as "insightData",
          confidence_score as "confidenceScore",
          detected_at as "detectedAt",
          previous_value as "previousValue",
          new_value as "newValue"
        FROM insights_history
        WHERE user_id = $1 AND insight_type = $2
        ORDER BY detected_at DESC
        LIMIT $3`
      : `SELECT 
          id,
          user_id as "userId",
          fax_job_id as "faxJobId",
          insight_type as "insightType",
          insight_category as "insightCategory",
          insight_data as "insightData",
          confidence_score as "confidenceScore",
          detected_at as "detectedAt",
          previous_value as "previousValue",
          new_value as "newValue"
        FROM insights_history
        WHERE user_id = $1
        ORDER BY detected_at DESC
        LIMIT $2`;
    
    const params = insightType ? [userId, insightType, limit] : [userId, limit];
    const result = await db.query<InsightHistoryEntry>(query, params);
    
    return result.rows;
  }

  /**
   * Get aggregate insights for data products
   */
  async getAggregates(filters: {
    region?: string;
    ageRange?: string;
    insightCategory?: string;
    periodStart?: Date;
    periodEnd?: Date;
  }): Promise<AggregateInsight[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (filters.region) {
      conditions.push(`region = $${paramIndex++}`);
      params.push(filters.region);
    }
    
    if (filters.ageRange) {
      conditions.push(`age_range = $${paramIndex++}`);
      params.push(filters.ageRange);
    }
    
    if (filters.insightCategory) {
      conditions.push(`insight_category = $${paramIndex++}`);
      params.push(filters.insightCategory);
    }
    
    if (filters.periodStart) {
      conditions.push(`period_start >= $${paramIndex++}`);
      params.push(filters.periodStart);
    }
    
    if (filters.periodEnd) {
      conditions.push(`period_end <= $${paramIndex++}`);
      params.push(filters.periodEnd);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const result = await db.query<AggregateInsight>(
      `SELECT 
        id,
        region,
        age_range as "ageRange",
        household_type as "householdType",
        insight_category as "insightCategory",
        aggregate_data as "aggregateData",
        period_start as "periodStart",
        period_end as "periodEnd",
        sample_size as "sampleSize",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM aggregate_insights
      ${whereClause}
      ORDER BY period_start DESC, region, age_range`,
      params
    );
    
    return result.rows;
  }

  /**
   * Create aggregate insight
   */
  async createAggregate(aggregate: Omit<AggregateInsight, 'id' | 'createdAt' | 'updatedAt'>): Promise<AggregateInsight> {
    const result = await db.query<AggregateInsight>(
      `INSERT INTO aggregate_insights (
        region, age_range, household_type, insight_category,
        aggregate_data, period_start, period_end, sample_size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id,
        region,
        age_range as "ageRange",
        household_type as "householdType",
        insight_category as "insightCategory",
        aggregate_data as "aggregateData",
        period_start as "periodStart",
        period_end as "periodEnd",
        sample_size as "sampleSize",
        created_at as "createdAt",
        updated_at as "updatedAt"`,
      [
        aggregate.region || null,
        aggregate.ageRange || null,
        aggregate.householdType || null,
        aggregate.insightCategory,
        JSON.stringify(aggregate.aggregateData),
        aggregate.periodStart,
        aggregate.periodEnd,
        aggregate.sampleSize
      ]
    );
    
    return result.rows[0];
  }

  /**
   * Delete user insights (GDPR compliance)
   */
  async deleteByUserId(userId: string): Promise<void> {
    await db.query('DELETE FROM user_insights WHERE user_id = $1', [userId]);
    // insights_history will cascade delete
  }
}

export const userInsightsRepository = new UserInsightsRepository();
