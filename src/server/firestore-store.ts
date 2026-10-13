import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Store, TelemetrySample } from './store';
import type { Alert, AuditEntry } from './sim/types';

interface Credentials {
  projectId: string;
  /** Omit both for the Firestore emulator (FIRESTORE_EMULATOR_HOST), which needs no credentials. */
  clientEmail?: string;
  privateKey?: string;
}

/** Firestore-backed store. Collections: `telemetry`, `alerts`, `audit` (doc id = entry id). */
export class FirestoreStore implements Store {
  readonly kind = 'firestore';
  private readonly db: Firestore;

  constructor(credentials: Credentials) {
    const { projectId, clientEmail, privateKey } = credentials;
    const app =
      getApps()[0] ??
      initializeApp(
        clientEmail && privateKey
          ? { projectId, credential: cert({ projectId, clientEmail, privateKey }) }
          : { projectId },
      );
    this.db = getFirestore(app);
  }

  async saveTelemetry(sample: TelemetrySample) {
    await this.db.collection('telemetry').doc(sample.ts).set(sample);
  }

  async saveAlert(alert: Alert) {
    await this.db.collection('alerts').doc(alert.id).set(alert);
  }

  async saveAudit(entry: AuditEntry) {
    await this.db.collection('audit').doc(entry.id).set(entry);
  }

  async history({ from, to, limit = 5000 }: { from: string; to: string; limit?: number }) {
    const snap = await this.db
      .collection('telemetry')
      .where('ts', '>=', from)
      .where('ts', '<=', to)
      .orderBy('ts', 'asc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as TelemetrySample);
  }

  async recentAudit(limit: number) {
    const snap = await this.db.collection('audit').orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map((d) => d.data() as AuditEntry);
  }
}
