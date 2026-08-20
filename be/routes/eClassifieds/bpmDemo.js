/**
 * eClassifieds BPM helloworld demo — bpmn-engine (in-memory).
 * Choice A: Classified Ad Moderation with fake static listings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { Engine } from 'bpmn-engine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BPMN_PATH = path.resolve(__dirname, '../../bpmn/classifiedAdModeration.bpmn');

const STATIC_LISTINGS = [
  {
    id: 'L-1001',
    title: 'Vintage road bike',
    category: 'Sports',
    price: 220,
    city: 'Arlington, VA',
    seller: 'AlexRider',
    status: 'draft'
  },
  {
    id: 'L-1002',
    title: 'Ikea desk + chair',
    category: 'Furniture',
    price: 75,
    city: 'Reston, VA',
    seller: 'NestNova',
    status: 'draft'
  },
  {
    id: 'L-1003',
    title: 'iPhone 13 — unlocked',
    category: 'Electronics',
    price: 410,
    city: 'Bethesda, MD',
    seller: 'TechToby',
    status: 'draft'
  },
  {
    id: 'L-1004',
    title: 'Concert tickets (2)',
    category: 'Tickets',
    price: 160,
    city: 'Washington, DC',
    seller: 'MelodyMae',
    status: 'draft'
  }
];

/** @type {Map<string, object>} */
const instances = new Map();
let seq = 1;

function loadBpmnXml() {
  return fs.readFileSync(BPMN_PATH, 'utf8');
}

function noopService(_scope, next) {
  setImmediate(() => next());
}

function snapshot(record) {
  return {
    instanceId: record.instanceId,
    listingId: record.listingId,
    listing: record.listing,
    status: record.status,
    decision: record.decision,
    waitingOn: record.waitingOn,
    currentActivityIds: [...record.currentActivityIds],
    completedActivityIds: [...record.completedActivityIds],
    startedAt: record.startedAt,
    finishedAt: record.finishedAt || null,
    trail: [...record.trail]
  };
}

async function createAndRunInstance(listing) {
  const instanceId = `bpm-${Date.now()}-${seq++}`;
  const source = loadBpmnXml();
  const engine = new Engine({ name: instanceId, source });
  const listener = new EventEmitter();

  const record = {
    instanceId,
    listingId: listing.id,
    listing: { ...listing },
    status: 'running',
    decision: null,
    waitingOn: null,
    waitApi: null,
    currentActivityIds: [],
    completedActivityIds: [],
    trail: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    engine,
    listener
  };

  listener.on('activity.start', (activity) => {
    if (!record.currentActivityIds.includes(activity.id)) {
      record.currentActivityIds.push(activity.id);
    }
    record.trail.push({ at: new Date().toISOString(), type: 'start', id: activity.id, name: activity.name });
  });

  listener.on('activity.end', (activity) => {
    record.currentActivityIds = record.currentActivityIds.filter((id) => id !== activity.id);
    if (!record.completedActivityIds.includes(activity.id)) {
      record.completedActivityIds.push(activity.id);
    }
    record.trail.push({ at: new Date().toISOString(), type: 'end', id: activity.id, name: activity.name });
    if (activity.type === 'bpmn:EndEvent') {
      record.status = 'completed';
      record.waitingOn = null;
      record.waitApi = null;
      record.finishedAt = new Date().toISOString();
      if (activity.id === 'EndApproved') record.decision = 'approve';
      if (activity.id === 'EndRejected') record.decision = 'reject';
    }
  });

  listener.on('wait', (api) => {
    record.status = 'waiting';
    record.waitingOn = api.id;
    record.waitApi = api;
    record.trail.push({ at: new Date().toISOString(), type: 'wait', id: api.id, name: api.name });
  });

  instances.set(instanceId, record);

  await engine.execute({
    listener,
    variables: {
      listingId: listing.id,
      title: listing.title,
      price: listing.price,
      category: listing.category,
      decision: ''
    },
    services: { noop: noopService }
  });

  return record;
}

export function getBpmDiagram(_req, res) {
  try {
    const xml = loadBpmnXml();
    return res.json({
      processId: 'ClassifiedAdModeration',
      name: 'Classified Ad Moderation',
      xml
    });
  } catch (err) {
    console.error('[eClassifiedsBpm] diagram', err);
    return res.status(500).json({ error: 'Failed to load BPMN diagram' });
  }
}

export function getBpmListings(_req, res) {
  return res.json({ listings: STATIC_LISTINGS });
}

export function getBpmInstances(_req, res) {
  const list = [...instances.values()]
    .map(snapshot)
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  return res.json({ instances: list });
}

export function getBpmPending(_req, res) {
  const pending = [...instances.values()]
    .filter((r) => r.status === 'waiting' && r.waitingOn === 'ManualReview')
    .map(snapshot);
  return res.json({ pending });
}

export function getBpmInstance(req, res) {
  const record = instances.get(String(req.params.instanceId || ''));
  if (!record) return res.status(404).json({ error: 'Instance not found' });
  return res.json(snapshot(record));
}

export async function postBpmStart(req, res) {
  const listingId = String(req.body?.listingId || '').trim();
  const listing = STATIC_LISTINGS.find((l) => l.id === listingId);
  if (!listing) {
    return res.status(400).json({ error: 'Unknown listingId. Use a fake listing from GET /api/eClassifieds/bpm/listings' });
  }
  try {
    const record = await createAndRunInstance(listing);
    // Allow service tasks to settle into wait
    await new Promise((r) => setTimeout(r, 30));
    return res.status(201).json(snapshot(record));
  } catch (err) {
    console.error('[eClassifiedsBpm] start', err);
    return res.status(500).json({ error: err?.message || 'Failed to start process' });
  }
}

export async function postBpmComplete(req, res) {
  const record = instances.get(String(req.params.instanceId || ''));
  if (!record) return res.status(404).json({ error: 'Instance not found' });
  if (record.status !== 'waiting' || !record.waitApi) {
    return res.status(409).json({ error: 'Instance is not waiting on a user task', status: record.status });
  }

  const decision = String(req.body?.decision || '')
    .trim()
    .toLowerCase();
  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ error: 'decision must be "approve" or "reject"' });
  }

  try {
    record.decision = decision;
    record.waitApi.environment.variables.decision = decision;
    const api = record.waitApi;
    record.waitApi = null;
    record.waitingOn = null;
    record.status = 'running';
    api.signal();
    await new Promise((r) => setTimeout(r, 50));
    return res.json(snapshot(record));
  } catch (err) {
    console.error('[eClassifiedsBpm] complete', err);
    return res.status(500).json({ error: err?.message || 'Failed to complete task' });
  }
}

/** Wipe all in-memory demo instances — same empty state as a fresh BE start. */
export function postBpmResetAll(_req, res) {
  for (const record of instances.values()) {
    try {
      record.waitApi = null;
      record.engine?.stop?.();
    } catch {
      /* best-effort stop */
    }
  }
  instances.clear();
  seq = 1;
  return res.json({ ok: true, cleared: true, instances: [] });
}
