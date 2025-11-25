#!/bin/bash

# View Insights Database Helper
# Quick commands to explore the insights database

export PGPASSWORD=faxi_password

echo "📊 Faxi Insights Database Viewer"
echo "================================"
echo ""

# Check if tables exist
echo "1. Checking if insights tables exist..."
psql -h localhost -p 5432 -U faxi_user -d faxi -c "\dt user_insights" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Tables exist"
else
    echo "❌ Tables don't exist. Run: npm run migrate"
    exit 1
fi
echo ""

# Count profiles
echo "2. User Profiles Count:"
psql -h localhost -p 5432 -U faxi_user -d faxi -t -c "SELECT COUNT(*) FROM user_insights;"
echo ""

# Show recent profiles
echo "3. Recent User Profiles (last 5):"
psql -h localhost -p 5432 -U faxi_user -d faxi -c "
SELECT 
  user_id,
  age_range,
  gender,
  region,
  digital_exclusion_score,
  total_interactions,
  last_interaction_at
FROM user_insights 
ORDER BY last_interaction_at DESC NULLS LAST
LIMIT 5;
"
echo ""

# Show recent insights
echo "4. Recent Insights (last 10):"
psql -h localhost -p 5432 -U faxi_user -d faxi -c "
SELECT 
  insight_type,
  insight_category,
  confidence_score,
  detected_at
FROM insights_history 
ORDER BY detected_at DESC 
LIMIT 10;
"
echo ""

# Insights by type
echo "5. Insights by Type:"
psql -h localhost -p 5432 -U faxi_user -d faxi -c "
SELECT 
  insight_type,
  COUNT(*) as count
FROM insights_history 
GROUP BY insight_type
ORDER BY count DESC;
"
echo ""

# Show a sample profile (if any exist)
echo "6. Sample Profile (full JSON):"
psql -h localhost -p 5432 -U faxi_user -d faxi -c "
SELECT 
  user_id,
  jsonb_pretty(profile_data) as profile
FROM user_insights 
LIMIT 1;
"
echo ""

echo "💡 Tips:"
echo "  - Connect directly: psql -h localhost -p 5432 -U faxi_user -d faxi"
echo "  - Password: faxi_password"
echo "  - View specific user: SELECT * FROM user_insights WHERE user_id = 'UUID';"
echo "  - Pretty JSON: SELECT jsonb_pretty(profile_data) FROM user_insights;"
