# PostgreSQL Compute Cost Reduction Guide

## Issues Found & Solutions

### 1. **CRITICAL: N+1 Queries in `getResultCounts()` and `getContentCounts()`**
**Current Implementation** (server/storage.ts):
```typescript
async getResultCounts(studentId?: number): Promise<Record<string, number>> {
  const types = ['typing', 'shorthand'];
  const resultObj: Record<string, number> = {};

  for (const t of types) {  // ❌ Loops through types
    // Makes SEPARATE database call for each type
    const [row] = await q;
    resultObj[t] = Number(row?.cnt ?? 0);
  }
  return resultObj;
}
```

**Impact**: 
- **2 separate queries** instead of 1
- Every time dashboard loads: 2 extra queries
- Multiplied by number of active users

**Solution - Use Single Query with GROUP BY**:
```typescript
async getResultCounts(studentId?: number): Promise<Record<string, number>> {
  const conditions: any[] = [];
  if (typeof studentId === 'number') conditions.push(eq(results.studentId, studentId));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Single query with GROUP BY
  const rows: any = await db
    .select({
      contentType: results.contentType,
      cnt: sql`count(*)`.as('cnt')
    })
    .from(results)
    .where(whereClause)
    .groupBy(results.contentType);

  const resultObj: Record<string, number> = {};
  rows.forEach((row: any) => {
    resultObj[row.contentType] = Number(row.cnt ?? 0);
  });
  return resultObj;
}
```

**Savings**: **50% reduction** in count queries

---

### 2. **CRITICAL: N+1 Queries in `getContentCounts()`**
Same issue as above - also uses loop with separate queries.

**Solution**: Apply same GROUP BY approach as getResultCounts().

**Savings**: **50% reduction** in count queries

---

### 3. **Database Connection Pool Underutilization**
**Current** (server/db.ts):
```typescript
max: 3,  // ❌ Only 3 connections
```

**Issue**: 
- Small pool can cause connection exhaustion during traffic spikes
- Forces requests to wait for connection availability
- This increases CPU/compute time per request

**Solution**:
```typescript
max: 5,  // Increase to 5 for more concurrency
```

**Savings**: Reduces connection wait times, faster query execution

---

### 4. **Missing Database Indexes**
These queries run frequently but lack optimized indexes:

**Missing Indexes to Add**:
```sql
-- Results table indexes (used frequently)
CREATE INDEX IF NOT EXISTS idx_results_student_id_submitted_at 
  ON results(student_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_results_content_id 
  ON results(content_id);

-- Content table indexes
CREATE INDEX IF NOT EXISTS idx_content_folder_id_is_enabled 
  ON content(folder_id, is_enabled);

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_batch 
  ON users(batch);
```

**Savings**: **30-50% faster queries** = less compute time

---

### 5. **Unnecessary Column Selections**
When fetching results, entire text content is being transferred:

**Current**: `SELECT * FROM results` includes:
- `typed_text` (large - potentially 50KB+)
- `original_text` (large - potentially 50KB+)

**Issue**: 
- Dashboard list queries fetch full text for every result
- Massive data transfer = high compute/bandwidth cost
- 1000 results × 50KB = 50MB data transfer per query

**Solution - Create selective queries**:
```typescript
// For list views - exclude large text fields
async getResultsPagedSummary(type?: string, studentId?: number, limit?: number, offset?: number) {
  return await db
    .select({
      id: results.id,
      studentId: results.studentId,
      studentName: results.studentName,
      contentTitle: results.contentTitle,
      contentType: results.contentType,
      words: results.words,
      mistakes: results.mistakes,
      result: results.result,
      submittedAt: results.submittedAt,
    })
    .from(results)
    .where(/* conditions */)
    .orderBy(desc(results.submittedAt))
    .limit(limit)
    .offset(offset);
}

// For detail view - fetch full text only when needed
async getResultDetail(id: number) {
  return await db.select().from(results).where(eq(results.id, id));
}
```

**Savings**: **40-60% reduction** in data transfer and compute

---

### 6. **Connection Keep-Alive Polling**
**Current** (server/db.ts):
```typescript
setInterval(warmupDatabase, 4 * 60 * 1000);  // Every 4 minutes
```

**Issue**: 
- Continuous polling = idle compute time
- Uses connection slot constantly

**Solution**: 
Only warmup on first request after idle period:
```typescript
let lastWarmup = Date.now();
const WARMUP_INTERVAL = 4 * 60 * 1000;

export async function conditionalWarmup() {
  const now = Date.now();
  if (now - lastWarmup > WARMUP_INTERVAL) {
    lastWarmup = now;
    return warmupDatabase();
  }
}

// Call this on middleware
```

**Savings**: **15-20% reduction** in idle compute

---

### 7. **Query Result Caching Strategy**
**Current**: Some caches are 30 minutes, others are not configured.

**Recommendations**:
```typescript
// Frontend caching times
useQuery({
  staleTime: 5 * 60 * 1000,    // 5 min for content lists
  gcTime: 30 * 60 * 1000,      // Keep 30 min in cache
  refetchOnWindowFocus: false,  // Don't refetch on focus
  refetchOnReconnect: 'stale',  // Only if stale
});
```

**Savings**: **20-30% fewer queries** from client

---

## Implementation Priority

| Priority | Issue | Estimated Savings |
|----------|-------|------------------|
| **1** | N+1 getResultCounts/getContentCounts | **50% reduction** |
| **2** | Missing indexes on results/content | **30-50% faster** |
| **3** | Selective column queries | **40-60% less data** |
| **4** | Connection pool optimization | **10-15% faster** |
| **5** | Smart cache invalidation | **20-30% fewer queries** |
| **6** | Conditional warmup | **15-20% less idle** |

## Total Estimated Reduction: **40-60% compute cost savings**

---

## Code Files to Modify

1. **server/storage.ts** - Fix N+1 queries
2. **server/db.ts** - Increase connection pool
3. **migrations/add_indexes.sql** - Add missing indexes
4. **client/src/lib/hooks/** - Optimize cache settings

