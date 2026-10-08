import { Pool } from "pg";
import { assertDatabaseConfigured } from "./database-errors";
import type { SessionInput } from "./validation";
const globalDb = globalThis as unknown as { pool?: Pool };
export const pool =
  globalDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== "production") globalDb.pool = pool;
const sessionSelect = `SELECT s.id, to_char(s.date,'YYYY-MM-DD') AS date, s.week,
 to_char(s.arrival_time,'HH24:MI') AS "arrivalTime", to_char(s.departure_time,'HH24:MI') AS "departureTime", s.topic,
 json_build_object('name',sc.name) AS school,
 COALESCE((SELECT json_agg(json_build_object('status',a.status,'arrivalTime',to_char(a.arrival_time,'HH24:MI'),'departureTime',to_char(a.departure_time,'HH24:MI'),'participant',json_build_object('name',p.name)) ORDER BY p.name)
 FROM attendance a JOIN participants p ON p.id=a.participant_id WHERE a.session_id=s.id),'[]'::json) AS attendance
 FROM sessions s JOIN schools sc ON sc.id=s.school_id`;
export async function getSessions(
  week: number | undefined,
  date: string | undefined,
  page: number,
) {
  assertDatabaseConfigured(process.env.DATABASE_URL);
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (week) {
    params.push(week);
    conditions.push(`s.week=$${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`s.date=$${params.length}`);
  }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const total = await pool.query(
    "SELECT count(*)::int AS total FROM sessions s" + where,
    params,
  );
  const sessions = await pool.query(
    sessionSelect +
      where +
      ` ORDER BY s.date DESC,s.arrival_time DESC,s.created_at DESC LIMIT 50 OFFSET $${params.length + 1}`,
    [...params, (page - 1) * 50],
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [counts, sessionCount, todaySessions] = await Promise.all([
    pool.query(
      "SELECT status, count(*)::int AS count FROM attendance GROUP BY status",
    ),
    pool.query("SELECT count(*)::int AS count FROM sessions"),
    pool.query(sessionSelect + " WHERE s.date=$1 ORDER BY s.arrival_time", [
      today,
    ]),
  ]);
  return {
    sessions: sessions.rows,
    total: total.rows[0].total,
    page,
    pageSize: 50,
    stats: {
      sessionCount: sessionCount.rows[0].count,
      counts: counts.rows.map((c) => ({
        status: c.status,
        _count: { _all: c.count },
      })),
      todaySessions: todaySessions.rows,
    },
  };
}
export async function createSession(v: SessionInput) {
  assertDatabaseConfigured(process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const school = await client.query(
      "INSERT INTO schools(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
      [v.school],
    );
    const schoolId = school.rows[0].id;
    const session = await client.query(
      "INSERT INTO sessions(school_id,date,week,arrival_time,departure_time,topic) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [
        schoolId,
        v.date,
        v.week,
        v.arrivalTime,
        v.departureTime ?? null,
        v.topic,
      ],
    );
    for (const a of v.attendance) {
      const participant = await client.query(
        "INSERT INTO participants(school_id,name) VALUES($1,$2) ON CONFLICT(school_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        [schoolId, a.name],
      );
      await client.query(
        "INSERT INTO attendance(session_id,participant_id,status,arrival_time,departure_time) VALUES($1,$2,$3,$4,$5)",
        [
          session.rows[0].id,
          participant.rows[0].id,
          a.status,
          a.arrivalTime ?? null,
          a.departureTime ?? null,
        ],
      );
    }
    const result = await client.query(sessionSelect + " WHERE s.id=$1", [
      session.rows[0].id,
    ]);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
