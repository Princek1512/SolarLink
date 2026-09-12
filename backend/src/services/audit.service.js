const db = require('./db.service');

/**
 * Append-only audit log writer.
 * Fire-and-forget — never throws, never blocks the caller.
 */
async function log(actorId, actorRole, eventType, entityType, entityId, status, details, ipAddress) {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_role, event_type, entity_type, entity_id, status, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [actorId || null, actorRole || null, eventType, entityType || null, entityId || null, status || null, details ? JSON.stringify(details) : null, ipAddress || null]
    );
  } catch (err) {
    // Non-critical — log to console but never fail the caller
    console.error('[AuditService] Failed to write audit log:', err.message);
  }
}

module.exports = { log };
