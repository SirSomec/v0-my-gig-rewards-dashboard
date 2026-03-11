/**
 * Mock TOJ (Terms of Job) API — смены (Jobs).
 * Запуск в отдельном контейнере. Basic Auth и админ-ключ из env.
 */

const express = require('express');
const app = express();

const PORT = Number(process.env.PORT) || 3010;
const MOCK_TOJ_USER = process.env.MOCK_TOJ_USER || 'mock';
const MOCK_TOJ_PASSWORD = process.env.MOCK_TOJ_PASSWORD || 'mock';
const MOCK_TOJ_ADMIN_KEY = process.env.MOCK_TOJ_ADMIN_KEY || 'mock-admin-key';

app.use(express.json({ limit: '1mb' }));

// ——— In-memory store for jobs (TOJ JobEntityOptional-like) ———
let jobs = [];

function nextId() {
  return Buffer.from(Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toString('base64url').slice(0, 24);
}

function wrap(data, error = null) {
  return { data, error };
}

// ——— Basic Auth for TOJ endpoints ———
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="TOJ Mock"');
    res.status(401).json(wrap(null, 'Unauthorized'));
    return;
  }
  const b64 = auth.slice(6);
  let decoded;
  try {
    decoded = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    res.status(401).json(wrap(null, 'Unauthorized'));
    return;
  }
  const i = decoded.indexOf(':');
  const user = i >= 0 ? decoded.slice(0, i) : decoded;
  const pass = i >= 0 ? decoded.slice(i + 1) : '';
  if (user !== MOCK_TOJ_USER || pass !== MOCK_TOJ_PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="TOJ Mock"');
    res.status(401).json(wrap(null, 'Unauthorized'));
    return;
  }
  next();
}

// ——— Admin key for generate endpoint ———
function adminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!MOCK_TOJ_ADMIN_KEY || key !== MOCK_TOJ_ADMIN_KEY) {
    res.status(403).json(wrap(null, 'Forbidden'));
    return;
  }
  next();
}

// ——— Parse gte/lte from TOJ filter arrays (e.g. start: ["gte:2025-01-01", "lte:2025-03-01"]) ———
function parseDateRange(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let gte = null;
  let lte = null;
  for (const s of arr) {
    if (typeof s !== 'string') continue;
    if (s.startsWith('gte:')) gte = s.slice(4).trim();
    if (s.startsWith('lte:')) lte = s.slice(4).trim();
  }
  if (gte == null && lte == null) return null;
  return { gte, lte };
}

function dateInRange(isoStr, range) {
  if (!range) return true;
  const t = new Date(isoStr).getTime();
  if (range.gte && t < new Date(range.gte).getTime()) return false;
  if (range.lte && t > new Date(range.lte).getTime()) return false;
  return true;
}

// ——— POST /job.find-many.query ———
app.post('/job.find-many.query', basicAuth, (req, res) => {
  const body = req.body?.data;
  const filters = body?.filters || {};
  const options = body?.options || {};
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 1000);
  const skip = Math.max(Number(options.skip) || 0, 0);
  const sort = options.sort || { createdAt: -1 };

  let list = [...jobs];

  if (Array.isArray(filters.ids) && filters.ids.length > 0) {
    const idSet = new Set(filters.ids.map(String));
    list = list.filter((j) => idSet.has(String(j._id)));
  }
  if (Array.isArray(filters.workerIds) && filters.workerIds.length > 0) {
    const workerSet = new Set(filters.workerIds.map(String));
    list = list.filter((j) => j.workerId && workerSet.has(String(j.workerId)));
  }
  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    const statusSet = new Set(filters.statuses);
    list = list.filter((j) => statusSet.has(j.status));
  }
  const startRange = parseDateRange(filters.start);
  if (startRange) {
    list = list.filter((j) => j.start && dateInRange(j.start, startRange));
  }
  const finishRange = parseDateRange(filters.finish);
  if (finishRange) {
    list = list.filter((j) => j.finish && dateInRange(j.finish, finishRange));
  }
  const updatedAtRange = parseDateRange(filters.updatedAt);
  if (updatedAtRange) {
    list = list.filter((j) => j.updatedAt && dateInRange(j.updatedAt, updatedAtRange));
  }

  const sortKey = typeof sort === 'object' && sort !== null ? Object.keys(sort)[0] : 'createdAt';
  const sortDir = sort && sort[sortKey];
  list.sort((a, b) => {
    const va = a[sortKey] != null ? (typeof a[sortKey] === 'string' ? a[sortKey] : a[sortKey]) : '';
    const vb = b[sortKey] != null ? (typeof b[sortKey] === 'string' ? b[sortKey] : b[sortKey]) : '';
    const c = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === 1 || sortDir === '1' ? c : -c;
  });

  const total = list.length;
  const page = list.slice(skip, skip + limit);
  res.json(wrap(page));
});

// ——— POST /job.count.query ———
app.post('/job.count.query', basicAuth, (req, res) => {
  const filters = req.body?.data?.filters || {};
  let list = [...jobs];

  if (Array.isArray(filters.ids) && filters.ids.length > 0) {
    const idSet = new Set(filters.ids.map(String));
    list = list.filter((j) => idSet.has(String(j._id)));
  }
  if (Array.isArray(filters.workerIds) && filters.workerIds.length > 0) {
    const workerSet = new Set(filters.workerIds.map(String));
    list = list.filter((j) => j.workerId && workerSet.has(String(j.workerId)));
  }
  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    const statusSet = new Set(filters.statuses);
    list = list.filter((j) => statusSet.has(j.status));
  }
  const startRange = parseDateRange(filters.start);
  if (startRange) list = list.filter((j) => j.start && dateInRange(j.start, startRange));
  const finishRange = parseDateRange(filters.finish);
  if (finishRange) list = list.filter((j) => j.finish && dateInRange(j.finish, finishRange));

  res.json(wrap({ total: list.length }));
});

// ——— POST /job.find-by-id.query ———
app.post('/job.find-by-id.query', basicAuth, (req, res) => {
  const id = req.body?.data?.id;
  if (!id) {
    return res.status(400).json(wrap(null, 'id required'));
  }
  const job = jobs.find((j) => String(j._id) === String(id));
  res.json(wrap(job ?? null));
});

// ——— Generate mock jobs (admin only) ———
function generateJobs(count, workerIds, dateFrom, dateTo, statuses) {
  const statusList = Array.isArray(statuses) && statuses.length > 0 ? statuses : ['confirmed'];
  const workers = Array.isArray(workerIds) && workerIds.length > 0 ? workerIds : ['mock-worker-1'];
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const to = dateTo ? new Date(dateTo) : new Date();
  const tsFrom = from.getTime();
  const tsTo = to.getTime();
  const span = Math.max(tsTo - tsFrom, 1);

  const customNames = ['Курьерская доставка', 'Склад', 'Мерчандайзинг', 'Промо-акция', 'Ресторан', 'Ритейл'];
  const specs = ['courier', 'warehouse', 'merchandising', 'promo', 'restaurant', 'retail'];

  const newJobs = [];
  for (let i = 0; i < count; i++) {
    const t = tsFrom + Math.floor(Math.random() * span);
    const startDate = new Date(t);
    const hours = 4 + Math.floor(Math.random() * 6);
    const endDate = new Date(t + hours * 60 * 60 * 1000);
    const workerId = workers[i % workers.length];
    const idx = i % customNames.length;
    const job = {
      _id: nextId(),
      status: statusList[i % statusList.length],
      workerId,
      employerId: 'mock-employer-1',
      clientId: 'mock-client-1',
      workplaceId: 'mock-workplace-1',
      coordinatorId: 'mock-coordinator-1',
      spec: specs[idx],
      customName: customNames[idx],
      description: `Моковая смена ${i + 1}`,
      department: 'mock-dept',
      start: startDate.toISOString(),
      finish: endDate.toISOString(),
      startFact: startDate.toISOString(),
      finishFact: endDate.toISOString(),
      hours,
      minutes: hours * 60,
      salaryPerHour: 200 + Math.floor(Math.random() * 100),
      paymentPerJob: 0,
      paymentPerHour: 250 + Math.floor(Math.random() * 100),
      salaryPerJob: 0,
      deleted: false,
      createdAt: startDate.toISOString(),
      updatedAt: endDate.toISOString(),
      statusChangeMeta: null,
    };
    newJobs.push(job);
  }
  jobs = newJobs;
  return newJobs.length;
}

// ——— Create a single booked job (admin only) ———
// POST /admin/create-booked-job — body: { workerId, start, finish?, customName?, spec?, clientId?, hours? }
app.post('/admin/create-booked-job', adminKey, (req, res) => {
  const body = req.body || {};
  const workerId = typeof body.workerId === 'string' ? body.workerId.trim() : null;
  const startRaw = body.start;
  if (!workerId) {
    return res.status(400).json(wrap(null, 'workerId required'));
  }
  const startDate = startRaw ? new Date(startRaw) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    return res.status(400).json(wrap(null, 'start must be a valid ISO date-time'));
  }
  const hours = typeof body.hours === 'number' && body.hours > 0 ? body.hours : 6;
  const endDate = new Date(startDate.getTime() + hours * 60 * 60 * 1000);
  const customName = typeof body.customName === 'string' ? body.customName.trim() : 'Забронированная смена';
  const spec = typeof body.spec === 'string' ? body.spec.trim() : 'retail';
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : 'mock-client-1';
  const finishIso = body.finish ? new Date(body.finish).toISOString() : endDate.toISOString();

  const now = new Date().toISOString();
  const job = {
    _id: nextId(),
    status: 'booked',
    workerId,
    employerId: 'mock-employer-1',
    clientId,
    workplaceId: 'mock-workplace-1',
    coordinatorId: 'mock-coordinator-1',
    spec,
    customName,
    description: 'Смена создана через «Создать забронированную смену»',
    department: 'mock-dept',
    start: startDate.toISOString(),
    finish: finishIso,
    startFact: startDate.toISOString(),
    finishFact: finishIso,
    hours,
    minutes: hours * 60,
    salaryPerHour: 250,
    paymentPerJob: 0,
    paymentPerHour: 280,
    salaryPerJob: 0,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    statusChangeMeta: null,
  };
  jobs.push(job);
  res.status(201).json(wrap(job));
});

// ——— Allowed statuses for update (TOJ-like) ———
const ALLOWED_STATUSES = ['booked', 'going', 'inprogress', 'completed', 'confirmed', 'cancelled', 'failed', 'delayed', 'waiting', 'expired'];

app.post('/admin/generate-jobs', adminKey, (req, res) => {
  const body = req.body || {};
  const count = Math.min(Math.max(Number(body.count) || 10, 1), 500);
  const workerIds = Array.isArray(body.workerIds) ? body.workerIds.filter((x) => typeof x === 'string') : [];
  const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : null;
  const dateTo = typeof body.dateTo === 'string' ? body.dateTo : null;
  const statuses = Array.isArray(body.statuses) ? body.statuses : ['confirmed'];

  const total = generateJobs(count, workerIds, dateFrom, dateTo, statuses);
  res.json(wrap({ generated: total, count: total }));
});

// ——— List current mock jobs (admin only, for UI) ———
app.get('/admin/jobs', adminKey, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const skip = Math.max(Number(req.query.skip) || 0, 0);
  const total = jobs.length;
  const items = jobs.slice(skip, skip + limit);
  res.json(wrap({ items, total }));
});

// ——— Update job status with initiator (admin only, для теста поздней отмены) ———
// PATCH /admin/jobs/:id — body: { status, initiatorType?, initiator? }
// Меняет статус смены, записывает meta инициатора (как в TOJ job.update.command).
app.patch('/admin/jobs/:id', adminKey, (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const job = jobs.find((j) => String(j._id) === String(id));
  if (!job) {
    return res.status(404).json(wrap(null, 'Job not found'));
  }
  const newStatus = typeof body.status === 'string' ? body.status.trim() : null;
  if (newStatus && !ALLOWED_STATUSES.includes(newStatus)) {
    return res.status(400).json(wrap(null, `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`));
  }
  const now = new Date().toISOString();
  if (newStatus) {
    job.status = newStatus;
    job.updatedAt = now;
    job.statusChangeMeta = {
      initiatorType: typeof body.initiatorType === 'string' ? body.initiatorType.trim() : null,
      initiator: typeof body.initiator === 'string' ? body.initiator.trim() : null,
      at: now,
    };
  }
  res.json(wrap(job));
});

// ——— Health (no auth) ———
app.get('/health', (req, res) => {
  res.json({ status: 'ok', jobsCount: jobs.length });
});

app.use((req, res) => {
  res.status(404).json(wrap(null, 'Not found'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock TOJ listening on port ${PORT}`);
});
