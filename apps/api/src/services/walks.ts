import { WalkListResponse, WalkRecord } from '@walkwhile/shared';
import { Database } from '../db/database.js';

const MAX_PAGE_SIZE = 100;

interface WalkRow {
  id: string;
  started_at: Date | string;
  ended_at: Date | string;
  outcome: WalkRecord['outcome'];
  wait_type: WalkRecord['waitType'];
  planned_minutes: number;
  duration_seconds: number;
  distance_meters: number;
  steps: number;
  returned_on_time: boolean;
  origin_latitude: number;
  origin_longitude: number;
  route_coordinates: [number, number][] | string;
}

const COLUMNS = `id, started_at, ended_at, outcome, wait_type, planned_minutes,
  duration_seconds, distance_meters, steps, returned_on_time, origin_latitude,
  origin_longitude, route_coordinates`;

function toRecord(row: WalkRow): WalkRecord {
  return {
    id: row.id,
    startedAt: new Date(row.started_at).toISOString(),
    endedAt: new Date(row.ended_at).toISOString(),
    outcome: row.outcome,
    waitType: row.wait_type,
    plannedMinutes: Number(row.planned_minutes),
    durationSeconds: row.duration_seconds,
    distanceMeters: row.distance_meters,
    steps: row.steps,
    returnedOnTime: row.returned_on_time,
    origin: { latitude: row.origin_latitude, longitude: row.origin_longitude },
    routeCoordinates:
      typeof row.route_coordinates === 'string'
        ? JSON.parse(row.route_coordinates)
        : row.route_coordinates,
  };
}

export class WalkService {
  constructor(private readonly db: Database) {}

  /**
   * Saves a walk. Saving the same id again updates it, so the phone can
   * safely retry. Returns false if the id belongs to another user.
   */
  async save(userId: string, walk: WalkRecord): Promise<boolean> {
    const { rows } = await this.db.query(
      `INSERT INTO walks (id, user_id, started_at, ended_at, outcome, wait_type,
         planned_minutes, duration_seconds, distance_meters, steps, returned_on_time,
         origin_latitude, origin_longitude, route_coordinates)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at,
         outcome = EXCLUDED.outcome, wait_type = EXCLUDED.wait_type,
         planned_minutes = EXCLUDED.planned_minutes,
         duration_seconds = EXCLUDED.duration_seconds,
         distance_meters = EXCLUDED.distance_meters, steps = EXCLUDED.steps,
         returned_on_time = EXCLUDED.returned_on_time,
         origin_latitude = EXCLUDED.origin_latitude,
         origin_longitude = EXCLUDED.origin_longitude,
         route_coordinates = EXCLUDED.route_coordinates, updated_at = now()
       WHERE walks.user_id = EXCLUDED.user_id
       RETURNING id`,
      [
        walk.id,
        userId,
        walk.startedAt,
        walk.endedAt,
        walk.outcome,
        walk.waitType,
        walk.plannedMinutes,
        walk.durationSeconds,
        walk.distanceMeters,
        walk.steps,
        walk.returnedOnTime,
        walk.origin.latitude,
        walk.origin.longitude,
        JSON.stringify(walk.routeCoordinates),
      ]
    );
    return rows.length > 0;
  }

  /** Newest first. `before` is the startedAt of the last walk on the previous page. */
  async list(userId: string, limit = 30, before?: string): Promise<WalkListResponse> {
    const pageSize = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
    const { rows } = await this.db.query<WalkRow>(
      `SELECT ${COLUMNS} FROM walks
        WHERE user_id = $1 AND ($2::timestamptz IS NULL OR started_at < $2)
        ORDER BY started_at DESC
        LIMIT $3`,
      [userId, before ?? null, pageSize + 1]
    );
    const walks = rows.slice(0, pageSize).map(toRecord);
    return {
      walks,
      nextCursor: rows.length > pageSize ? walks[walks.length - 1].startedAt : null,
    };
  }

  async get(userId: string, id: string): Promise<WalkRecord | null> {
    const { rows } = await this.db.query<WalkRow>(
      `SELECT ${COLUMNS} FROM walks WHERE user_id = $1 AND id = $2`,
      [userId, id]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const { rows } = await this.db.query(
      'DELETE FROM walks WHERE user_id = $1 AND id = $2 RETURNING id',
      [userId, id]
    );
    return rows.length > 0;
  }
}
