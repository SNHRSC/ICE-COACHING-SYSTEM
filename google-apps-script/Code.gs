/**
 * ICE COACHING SYSTEM — Google Sheets database adapter
 * Deploy as Web App (execute as the script owner). Requests must come through
 * the Next.js server route, which holds the shared secret outside the browser.
 *
 * Script Properties required:
 *   ICE_COACH_SHARED_SECRET  (random 32+ character secret; same value as Vercel env)
 * Optional, used by provisionCoachIce():
 *   ICE_COACH_EMAIL, ICE_COACH_NAME, ICE_COACH_PIN
 */
const DEFAULT_SPREADSHEET_ID = '1-1vOU_CbR-grqo0RGnX4UBXS7D7572XgxCpQSMUKUA8';

const TABS = {
  Profiles: ['email','full_name','role','pin_hash','coach_email','active','created_at'],
  Assignments: ['id','coach_email','trainee_email','title','period','starts_on','ends_on','focus','notes','status','created_at','updated_at'],
  Exercises: ['id','assignment_id','exercise_name','sort_order','sets','reps','target_weight','rest_seconds','rir','coach_cue'],
  WorkoutLogs: ['id','assignment_id','exercise_id','trainee_email','performed_on','set_number','actual_reps','actual_weight','rir','completed','notes','created_at'],
  CheckIns: ['id','trainee_email','submitted_at','body_weight','sleep_hours','energy','soreness','notes']
};

function doGet() {
  return json_({ ok: true, service: 'ICE COACHING Google Sheets adapter', status: 'ready' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('ICE_COACH_SHARED_SECRET');
    if (!secret || !constantTimeEqual_(String(body.secret || ''), secret)) return json_({ ok: false, error: 'Unauthorized' });
    ensureSheets_();
    const action = String(body.action || '');
    const payload = body.payload || {};

    if (action === 'login') return json_(login_(payload));
    const user = verifySession_(body.session);
    if (!user) return json_({ ok: false, error: 'Session expired. Please sign in again.' });

    switch (action) {
      case 'get_data': return json_(getData_(user));
      case 'create_assignment': return json_(createAssignment_(user, payload));
      case 'publish_assignment': return json_(publishAssignment_(user, payload));
      case 'add_exercise': return json_(addExercise_(user, payload));
      case 'create_trainee': return json_(createTrainee_(user, payload));
      case 'log_workout': return json_(logWorkout_(user, payload));
      case 'create_checkin': return json_(createCheckin_(user, payload));
      default: return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function configureDatabaseSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ICE_COACH_SPREADSHEET_ID', DEFAULT_SPREADSHEET_ID);
  const ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID); // validates owner access
  ensureSheets_();
  Logger.log('Configured existing spreadsheet: ' + ss.getUrl());
}

function provisionCoachIce() {
  const props = PropertiesService.getScriptProperties();
  const email = String(props.getProperty('ICE_COACH_EMAIL') || '').trim().toLowerCase();
  const name = String(props.getProperty('ICE_COACH_NAME') || 'Coach Ice').trim();
  const pin = String(props.getProperty('ICE_COACH_PIN') || '').trim();
  if (!email || pin.length < 6) throw new Error('Set ICE_COACH_EMAIL and ICE_COACH_PIN (at least 6 digits) in Script Properties first.');
  upsertProfile_(email, name, 'coach', pin, '');
  Logger.log('Coach profile provisioned: ' + email);
}

function upsertProfile_(email, fullName, role, pin, coachEmail) {
  const sh = sheet_('Profiles');
  const rows = records_('Profiles');
  const normalized = String(email).trim().toLowerCase();
  const values = [normalized, String(fullName || ''), role, pinHash_(normalized, String(pin)), String(coachEmail || '').toLowerCase(), true, now_()];
  const index = rows.findIndex(r => String(r.email).toLowerCase() === normalized);
  if (index >= 0) sh.getRange(index + 2, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}

function login_(p) {
  const email = String(p.email || '').trim().toLowerCase();
  const pin = String(p.pin || '').trim();
  const profile = records_('Profiles').find(r => String(r.email).toLowerCase() === email && truthy_(r.active));
  if (!profile || !constantTimeEqual_(String(profile.pin_hash || ''), pinHash_(email, pin))) return { ok: false, error: 'Email or PIN is incorrect.' };
  const claims = { email: email, name: String(profile.full_name || ''), role: String(profile.role || ''), exp: Date.now() + 12 * 60 * 60 * 1000 };
  return { ok: true, session: signSession_(claims), user: { email: claims.email, name: claims.name, role: claims.role } };
}

function getData_(user) {
  const isCoach = user.role === 'coach';
  const assignments = records_('Assignments').filter(r => isCoach
    ? String(r.coach_email).toLowerCase() === user.email
    : String(r.trainee_email).toLowerCase() === user.email && ['published','completed'].includes(String(r.status).toLowerCase()));
  const ids = assignments.map(a => String(a.id));
  const exercises = records_('Exercises').filter(r => ids.includes(String(r.assignment_id)));
  const logs = records_('WorkoutLogs').filter(r => isCoach
    ? assignments.some(a => String(a.trainee_email).toLowerCase() === String(r.trainee_email).toLowerCase() && String(a.id) === String(r.assignment_id))
    : String(r.trainee_email).toLowerCase() === user.email);
  const checkins = records_('CheckIns').filter(r => isCoach
    ? assignments.some(a => String(a.trainee_email).toLowerCase() === String(r.trainee_email).toLowerCase())
    : String(r.trainee_email).toLowerCase() === user.email);
  const trainees = isCoach ? records_('Profiles').filter(r => r.role === 'trainee' && String(r.coach_email).toLowerCase() === user.email && truthy_(r.active)).map(r => ({
    email: r.email, name: r.full_name, role: r.role, active: truthy_(r.active)
  })) : [];
  return { ok: true, user: { email: user.email, name: user.name, role: user.role }, assignments: assignments, exercises: exercises, workoutLogs: logs, checkIns: checkins, trainees: trainees };
}

function createAssignment_(user, p) {
  requireRole_(user, 'coach');
  const traineeEmail = String(p.trainee_email || '').trim().toLowerCase();
  if (traineeEmail) {
    const trainee = records_('Profiles').find(r => String(r.email).toLowerCase() === traineeEmail && String(r.coach_email).toLowerCase() === user.email && r.role === 'trainee' && truthy_(r.active));
    if (!trainee) throw new Error('Trainee is not linked to this coach.');
  }
  const period = String(p.period || '').toLowerCase();
  if (!['monthly','weekly','daily'].includes(period)) throw new Error('Period must be monthly, weekly or daily.');
  const starts = String(p.starts_on || '');
  const ends = String(p.ends_on || '');
  if (!starts || !ends || ends < starts) throw new Error('Valid start and end dates are required.');
  const id = Utilities.getUuid();
  const stamp = now_();
  sheet_('Assignments').appendRow([id, user.email, traineeEmail, required_(p.title, 'Assignment title'), period, starts, ends, String(p.focus || ''), String(p.notes || ''), 'draft', stamp, stamp]);
  return { ok: true, id: id, status: 'draft' };
}

function publishAssignment_(user, p) {
  requireRole_(user, 'coach');
  const found = findRow_('Assignments', 'id', String(p.id || ''));
  if (!found || String(found.record.coach_email).toLowerCase() !== user.email) throw new Error('Assignment not found.');
  sheet_('Assignments').getRange(found.row, 10).setValue('published');
  sheet_('Assignments').getRange(found.row, 12).setValue(now_());
  return { ok: true };
}

function addExercise_(user, p) {
  requireRole_(user, 'coach');
  const assignmentId = String(p.assignment_id || '');
  const found = findRow_('Assignments', 'id', assignmentId);
  if (!found || String(found.record.coach_email).toLowerCase() !== user.email) throw new Error('Assignment not found.');
  const id = Utilities.getUuid();
  sheet_('Exercises').appendRow([id, assignmentId, required_(p.exercise_name, 'Exercise name'), Number(p.sort_order || 0), Number(p.sets || 3), String(p.reps || '8-12'), p.target_weight || '', p.rest_seconds || '', p.rir || '', String(p.coach_cue || '')]);
  return { ok: true, id: id };
}

function createTrainee_(user, p) {
  requireRole_(user, 'coach');
  const email = String(p.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Valid trainee email is required.');
  const existing = records_('Profiles').find(r => String(r.email).toLowerCase() === email);
  if (existing) throw new Error('This email already has a profile.');
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  upsertProfile_(email, required_(p.full_name, 'Trainee name'), 'trainee', pin, user.email);
  return { ok: true, trainee: { email: email, name: String(p.full_name), role: 'trainee' }, temporaryPin: pin };
}

function logWorkout_(user, p) {
  requireRole_(user, 'trainee');
  const exerciseId = String(p.exercise_id || '');
  const exercise = findRow_('Exercises', 'id', exerciseId);
  if (!exercise) throw new Error('Exercise not found.');
  const assignment = findRow_('Assignments', 'id', String(exercise.record.assignment_id));
  if (!assignment || String(assignment.record.trainee_email).toLowerCase() !== user.email || !['published','completed'].includes(String(assignment.record.status).toLowerCase())) throw new Error('This exercise is not assigned to your account.');
  sheet_('WorkoutLogs').appendRow([Utilities.getUuid(), String(assignment.record.id), exerciseId, user.email, String(p.performed_on || new Date().toISOString().slice(0,10)), Number(p.set_number || 1), p.actual_reps || '', p.actual_weight || '', p.rir || '', Boolean(p.completed), String(p.notes || ''), now_()]);
  return { ok: true };
}

function createCheckin_(user, p) {
  requireRole_(user, 'trainee');
  sheet_('CheckIns').appendRow([Utilities.getUuid(), user.email, now_(), p.body_weight || '', p.sleep_hours || '', p.energy || '', p.soreness || '', String(p.notes || '')]);
  return { ok: true };
}

function verifySession_(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const secret = PropertiesService.getScriptProperties().getProperty('ICE_COACH_SHARED_SECRET');
  const expected = signature_(parts[0], secret);
  if (!constantTimeEqual_(parts[1], expected)) return null;
  const claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!claims.exp || Number(claims.exp) < Date.now()) return null;
  const profile = records_('Profiles').find(r => String(r.email).toLowerCase() === String(claims.email).toLowerCase() && truthy_(r.active));
  if (!profile || String(profile.role) !== String(claims.role)) return null;
  return { email: String(profile.email).toLowerCase(), name: String(profile.full_name || ''), role: String(profile.role) };
}
function signSession_(claims) {
  const encoded = Utilities.base64EncodeWebSafe(JSON.stringify(claims)).replace(/=+$/,'');
  const secret = PropertiesService.getScriptProperties().getProperty('ICE_COACH_SHARED_SECRET');
  return encoded + '.' + signature_(encoded, secret);
}
function signature_(data, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data, secret)).replace(/=+$/,'');
}
function pinHash_(email, pin) {
  const secret = PropertiesService.getScriptProperties().getProperty('ICE_COACH_SHARED_SECRET');
  return signature_(email.toLowerCase() + ':' + pin, secret);
}
function ensureSheets_() {
  const ss = database_();
  Object.keys(TABS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const expected = TABS[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,expected.length).setValues([expected]);
      sh.setFrozenRows(1);
    } else {
      const actual = sh.getRange(1,1,1,expected.length).getValues()[0].map(String);
      const matches = expected.every((header, i) => actual[i] === header);
      if (!matches) throw new Error('Tab "' + name + '" exists but its header row does not match the ICE schema. Rename the tab or update its headers before continuing.');
    }
  });
}
function database_() {
  const id = PropertiesService.getScriptProperties().getProperty('ICE_COACH_SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}
function sheet_(name) { return database_().getSheetByName(name); }
function records_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
    return obj;
  });
}
function findRow_(name, key, value) {
  const rows = records_(name);
  const index = rows.findIndex(r => String(r[key]) === String(value));
  return index < 0 ? null : { record: rows[index], row: index + 2 };
}
function requireRole_(user, role) { if (user.role !== role) throw new Error('This action is not allowed for your account.'); }
function truthy_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1'; }
function required_(v, label) { const s = String(v || '').trim(); if (!s) throw new Error(label + ' is required.'); return s; }
function now_() { return new Date().toISOString(); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function constantTimeEqual_(a,b) {
  a=String(a); b=String(b); if (a.length !== b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
