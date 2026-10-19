import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { HistoryRange, Store, TelemetrySample } from './store';
import type { Alert, AuditEntry } from './sim/types';

interface Credentials {
  projectId: string;
  /** Omit both for the Firestore emulator (FIRESTORE_EMULATOR_HOST), which needs no credentials. */
  clientEmail?: string;
  privateKey?: string;
}

/** Firestore-backed store. New telemetry and alerts are separated by simulator run. */
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
    // Run-specific document paths prevent different simulator sessions from
    // overwriting one another when their timestamps happen to match.
    const collection = sample.runId
      ? this.db.collection('sim_runs').doc(sample.runId).collection('telemetry')
      : this.db.collection('telemetry'); // Pre-migration records only.
    await collection.doc(sample.ts).set(sample);
  }

  async saveAlert(alert: Alert) {
    const collection = alert.runId
      ? this.db.collection('sim_runs').doc(alert.runId).collection('alerts')
      : this.db.collection('alerts'); // Legacy alerts only.
    await collection.doc(alert.id).set(alert);
  }

  async recentAlerts(limit: number, runId?: string) {
    const collection = runId
      ? this.db.collection('sim_runs').doc(runId).collection('alerts')
      : this.db.collection('alerts');
    const snap = await collection.orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map((doc) => doc.data() as Alert);
  }

  async saveAudit(entry: AuditEntry) {
    await this.db.collection('audit').doc(entry.id).set(entry);
  }

  async history({ from, to, limit = 5000, runId }: HistoryRange) {
    const collection = runId
      ? this.db.collection('sim_runs').doc(runId).collection('telemetry')
      : this.db.collection('telemetry');
    const snap = await collection
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
