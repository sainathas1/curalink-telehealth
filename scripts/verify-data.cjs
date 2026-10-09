#!/usr/bin/env node
'use strict';

// Exercise the actual TypeScript helpers, provider, and auth hook with isolated React/Firebase mocks.
// No SDK initialization, application credentials, real timers, or network requests are available.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
const ids = values => Array.from(values, value => value.id);
let passed = 0;

function load(relativePath, modules) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, module: { exports },
    require(name) {
      if (Object.hasOwn(modules, name)) return modules[name];
      throw new Error(`Unmocked module rejected: ${name}`);
    },
    queueMicrotask, Intl, Date,
    console: { warn() {}, error() {} },
  }, { filename: relativePath });
  return exports;
}

function hookHarness() {
  const slots = [];
  let cursor = 0;
  let pending = [];
  let dirty = false;
  let renderBody;
  let output;
  const react = {
    createContext: value => ({ value, Provider: Symbol('Provider') }),
    useContext: context => context.value,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => {
        slots[index].value = typeof update === 'function' ? update(slots[index].value) : update;
        dirty = true;
      }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, offset) => !Object.is(value, previous.dependencies[offset]))) {
        pending.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies: [...dependencies], cleanup: effect() };
        });
      }
    },
  };
  return {
    react,
    jsx: { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) },
    mount(body) { renderBody = body; return this.render(); },
    render() {
      for (let attempt = 0; attempt < 20; attempt++) {
        dirty = false; cursor = 0; pending = [];
        output = renderBody();
        for (const effect of pending) effect();
        if (!dirty) return output;
      }
      throw new Error('Mock React render did not settle');
    },
    unmount() { for (const slot of slots) slot.cleanup?.(); },
  };
}

function firestoreMock() {
  const subscriptions = [];
  const store = new Map();
  const committed = [];
  let generated = 0;
  let transactionCalls = 0;
  let failNextCommit = false;
  const snapshot = data => ({ exists: () => data !== undefined, data: () => data });
  const api = {
    collection: (_db, source) => ({ source }),
    doc(first, source, id) {
      return typeof source === 'string' ? { path: `${source}/${id}` } : { path: `${first.source}/auto_${++generated}` };
    },
    where: (field, operator, value) => ({ field, operator, value }),
    query: (collection, ...conditions) => ({ source: collection.source, conditions }),
    serverTimestamp: () => ({ mockServerTimestamp: true }),
    onSnapshot(target, receive, fail) {
      const subscription = { target, receive, fail, active: true };
      subscriptions.push(subscription);
      return () => { subscription.active = false; };
    },
    async runTransaction(_db, callback) {
      transactionCalls++;
      const staged = [];
      await callback({
        get: async reference => snapshot(store.get(reference.path)),
        set: (reference, data) => staged.push({ path: reference.path, data, operation: 'set' }),
        update: (reference, data) => staged.push({ path: reference.path, data, operation: 'update' }),
      });
      if (failNextCommit) { failNextCommit = false; throw new Error('Mock Firestore commit failed'); }
      for (const write of staged) {
        store.set(write.path, write.operation === 'update' ? { ...store.get(write.path), ...write.data } : write.data);
        committed.push(write);
      }
    },
    writeBatch() {
      const staged = [];
      return {
        set: (reference, data, options) => staged.push({ path: reference.path, data, options }),
        commit: async () => {
          if (failNextCommit) { failNextCommit = false; throw new Error('Mock Firestore commit failed'); }
          for (const write of staged) { store.set(write.path, write.data); committed.push(write); }
        },
      };
    },
  };
  return {
    api, subscriptions, store, committed,
    get transactionCalls() { return transactionCalls; },
    failCommit() { failNextCommit = true; },
    active() { return subscriptions.filter(subscription => subscription.active); },
    emitCollection(source, rows) {
      for (const subscription of [...subscriptions]) {
        if (!subscription.active || subscription.target.source !== source) continue;
        const matches = rows.filter(row => (subscription.target.conditions || []).every(condition => (
          condition.operator === '==' ? row.data[condition.field] === condition.value : condition.value.includes(row.data[condition.field])
        )));
        subscription.receive({ docs: matches.map(row => ({ id: row.id, data: () => row.data })) });
      }
    },
    emitDocument(documentPath, data) {
      for (const subscription of [...subscriptions]) {
        if (subscription.active && subscription.target.path === documentPath) subscription.receive(snapshot(data));
      }
    },
  };
}

const helpers = load('lib/telehealth-data.ts', {});
function providerFixture(profile = null) {
  let harness = hookHarness();
  const firestore = firestoreMock();
  const auth = { currentUser: profile ? { uid: profile.uid } : null };
  let currentProfile = profile;
  let mountedKey;
  const reactBridge = {
    createContext: value => ({ value, Provider: Symbol('Provider') }),
    useContext: context => context.value,
    useState: (...args) => harness.react.useState(...args),
    useEffect: (...args) => harness.react.useEffect(...args),
  };
  const provider = load('context/TelehealthContext.tsx', {
    react: reactBridge, 'react/jsx-runtime': harness.jsx,
    'firebase/firestore': firestore.api, '../lib/firebase': { auth, db: {} },
    '../hooks/useAuth': { useAuth: () => ({ currentUser: currentProfile, role: currentProfile?.role || 'Patient', isAuthenticated: Boolean(currentProfile) }) },
    '../hooks/useTelemetry': { useTelemetry: () => ({ telemetry: {}, history: [] }) },
    '../lib/telehealth-data': helpers,
  });
  function renderProvider() {
    const element = provider.TelehealthProvider({ children: null });
    // Model React's keyed child reconciliation: an identity change unmounts all old hooks/effects.
    const renderBody = () => {
      const currentElement = provider.TelehealthProvider({ children: null });
      return currentElement.type(currentElement.props).props.value;
    };
    if (element.key !== mountedKey) {
      harness.unmount(); harness = hookHarness(); mountedKey = element.key;
      return harness.mount(renderBody);
    }
    return harness.render();
  }
  renderProvider();
  return {
    firestore, auth,
    view: renderProvider,
    switchAccount(next) { currentProfile = next; auth.currentUser = next ? { uid: next.uid } : null; return this.view(); },
    unmount() { harness.unmount(); },
  };
}
function authFixture() {
  const harness = hookHarness();
  const firestore = firestoreMock();
  const auth = { currentUser: null };
  const observers = [];
  const authHook = load('hooks/useAuth.ts', {
    react: harness.react, 'firebase/firestore': firestore.api, '../lib/firebase': { auth, db: {} },
    'firebase/auth': {
      onAuthStateChanged: (_auth, receive, fail) => {
        const observer = { receive, fail, active: true }; observers.push(observer);
        return () => { observer.active = false; };
      },
      signOut: async () => { auth.currentUser = null; },
    },
  });
  harness.mount(() => authHook.useAuth());
  return {
    firestore,
    view: () => harness.render(),
    emit(account) { auth.currentUser = account; for (const observer of observers) if (observer.active) observer.receive(account); return this.view(); },
    unmount: () => harness.unmount(),
  };
}

const patient = { uid: 'patient_a', role: 'patient', fullName: 'Patient A', email: 'patient-a@example.invalid' };
const doctor = { uid: 'doctor_a', role: 'doctor', fullName: 'Doctor A', email: 'doctor-a@example.invalid', isVerified: true };
const appointment = { id: 'booking_a', patientId: patient.uid, doctorId: doctor.uid, patientName: patient.fullName, doctorName: doctor.fullName, doctorSpecialty: 'General care', date: '2026-10-09', time: '14:30', type: 'Video Call', status: 'scheduled', symptoms: 'Consultation' };
const row = (id, data) => ({ id, data });

async function test(name, run) {
  await run(); passed++; console.log(`PASS ${name}`);
}

async function main() {
  await test('appointment ordering preserves 24-hour minutes and AM/PM', () => {
    assert.equal(helpers.appointmentTime(appointment), Date.parse('2026-10-09T14:30:00+05:30'));
    assert.equal(helpers.appointmentTime({ ...appointment, time: '12:15 AM' }), Date.parse('2026-10-09T00:15:00+05:30'));
    assert.equal(helpers.appointmentTime({ ...appointment, time: '12:15 PM' }), Date.parse('2026-10-09T12:15:00+05:30'));
    const input = [{ ...appointment, id: 'later', time: '14:45' }, { ...appointment, id: 'earlier', time: '14:15' }];
    assert.deepEqual(ids(helpers.sortAppointments(input)), ['earlier', 'later']);
    assert.deepEqual(ids(input), ['later', 'earlier']);
  });
  await test('canonical upload mirrors merge without losing repeat records', () => {
    const data = { patientId: patient.uid, type: 'Lab Report', 'Document Title': 'Blood test', fileData: 'data:application/pdf;base64,fixture', createdAt: '2026-10-09' };
    const merged = helpers.mergeClinicalRecords([
      { id: 'legacy', source: 'clinical_records', data },
      { id: 'canonical', source: 'medical_records', data },
      { id: 'repeat', source: 'medical_records', data },
    ]);
    assert.deepEqual(ids(merged).sort(), ['medical_records/canonical', 'medical_records/repeat']);
    assert.equal(helpers.toMedicalRecord(merged[0]).fileData, data.fileData);
    assert.equal(helpers.mergeClinicalRecords([]).length, 0);
  });
  await test('same attachment for different patients remains distinct', () => {
    const entries = ['patient_a', 'patient_b'].map((patientId, index) => ({ id: `record_${index}`, source: 'medical_records', data: { patientId, type: 'Lab Report', fileData: 'data:application/pdf;base64,fixture' } }));
    assert.equal(helpers.mergeClinicalRecords(entries).length, 2);
  });
  await test('signed out and unverified doctors subscribe to no care data', () => {
    const fixture = providerFixture();
    assert.equal(fixture.firestore.active().length, 0);
    fixture.switchAccount({ ...doctor, isVerified: false });
    assert.equal(fixture.firestore.active().length, 0);
    assert.equal(fixture.view().patientDirectory.length, 0);
    fixture.unmount();
  });
  await test('patient appointment scope, deletions, and stale callbacks are isolated', () => {
    const fixture = providerFixture(patient);
    const listener = fixture.firestore.active().find(item => item.target.source === 'appointments');
    assert.deepEqual(plain(listener.target.conditions), [{ field: 'patientId', operator: '==', value: patient.uid }]);
    fixture.firestore.emitCollection('appointments', [row('own', appointment), row('foreign', { ...appointment, patientId: 'patient_b' })]);
    assert.deepEqual(ids(fixture.view().patientAppointments), ['own']);
    fixture.firestore.emitCollection('appointments', []);
    assert.equal(fixture.view().patientAppointments.length, 0);
    fixture.firestore.emitCollection('appointments', [row('own', appointment)]);
    fixture.view().openVideoCall(fixture.view().patientAppointments[0]);
    assert.equal(fixture.view().isVideoCallOpen, true);
    fixture.switchAccount({ ...patient, uid: 'patient_b' });
    assert.equal(fixture.view().isVideoCallOpen, false);
    assert.equal(fixture.view().activeCallAppointment, null);
    listener.receive({ docs: [{ id: 'stale', data: () => appointment }] });
    assert.equal(fixture.view().patientAppointments.length, 0);
    assert.equal(listener.active, false);
    fixture.switchAccount(null);
    assert.equal(fixture.firestore.active().length, 0);
    fixture.unmount();
  });
  await test('medical snapshots replace deleted records across collections', () => {
    const fixture = providerFixture(patient);
    fixture.firestore.emitCollection('medical_records', [row('report', { patientId: patient.uid, type: 'Lab Report', content: { title: 'A report' } })]);
    assert.deepEqual(ids(fixture.view().medicalRecords), ['medical_records/report']);
    fixture.firestore.emitCollection('medical_records', []);
    assert.equal(fixture.view().medicalRecords.length, 0);
    fixture.unmount();
  });
  await test('doctor appointments and patient relationships stay scoped', () => {
    const fixture = providerFixture(doctor);
    const listener = fixture.firestore.active().find(item => item.target.source === 'appointments');
    assert.deepEqual(plain(listener.target.conditions), [{ field: 'doctorId', operator: '==', value: doctor.uid }]);
    fixture.firestore.emitCollection('appointments', [row('own', appointment), row('foreign', { ...appointment, doctorId: 'doctor_b', patientId: 'patient_b' })]);
    fixture.firestore.emitCollection('users', []);
    fixture.firestore.emitDocument(`users/${patient.uid}`, { ...patient });
    assert.deepEqual(ids(fixture.view().doctorAppointmentsQueue), ['own']);
    assert.deepEqual(ids(fixture.view().patientDirectory), [patient.uid]);
    fixture.firestore.emitCollection('medical_records', [row('report', { patientId: patient.uid, type: 'Lab Report' })]);
    assert.equal(fixture.view().medicalRecords.length, 1);
    fixture.firestore.emitCollection('appointments', []);
    assert.equal(fixture.view().patientDirectory.length, 0);
    assert.equal(fixture.view().medicalRecords.length, 0);
    assert.equal(fixture.firestore.active().some(item => item.target.path === `users/${patient.uid}`), false);
    fixture.unmount();
  });
  await test('appointment failures propagate and stable retries create one booking', async () => {
    const fixture = providerFixture(patient);
    fixture.firestore.store.set(`users/${doctor.uid}`, doctor);
    fixture.firestore.failCommit();
    await assert.rejects(fixture.view().addAppointment(appointment), /commit failed/);
    assert.equal(fixture.firestore.store.has(`appointments/${appointment.id}`), false);
    assert.equal(fixture.view().patientAppointments.length, 0);
    await fixture.view().addAppointment(appointment);
    await fixture.view().addAppointment(appointment);
    assert.equal(fixture.firestore.committed.filter(write => write.path === `appointments/${appointment.id}`).length, 1);
    assert.equal(fixture.firestore.store.get(`appointments/${appointment.id}`).paymentStatus, 'Pending');
    await assert.rejects(fixture.view().addAppointment({ ...appointment, patientId: 'patient_b' }), /confirmed/);
    fixture.unmount();
  });
  await test('doctor verification is reread before saving an appointment', async () => {
    const fixture = providerFixture(patient);
    fixture.firestore.store.set(`users/${doctor.uid}`, { ...doctor, isVerified: false });
    await assert.rejects(fixture.view().addAppointment(appointment), /no longer available/);
    assert.equal(fixture.firestore.committed.length, 0);
    fixture.unmount();
  });
  await test('clinical notes use canonical storage and verified care relationships', async () => {
    const fixture = providerFixture(doctor);
    fixture.firestore.store.set(`users/${doctor.uid}`, doctor);
    fixture.firestore.store.set(`users/${patient.uid}`, { ...patient, assignedDoctorId: doctor.uid });
    await fixture.view().addClinicalNote(patient.uid, ' Review ', ' Follow up ', patient.fullName);
    assert.equal(fixture.firestore.committed.length, 1);
    assert.ok(fixture.firestore.committed[0].path.startsWith('medical_records/'));
    assert.equal(fixture.firestore.committed[0].data.content.title, 'Review');
    fixture.firestore.store.set(`users/${doctor.uid}`, { ...doctor, isVerified: false });
    await assert.rejects(fixture.view().addClinicalNote(patient.uid, 'Review', 'Follow up'), /no longer verified/);
    fixture.firestore.store.set(`users/${doctor.uid}`, doctor);
    fixture.firestore.store.set(`users/${patient.uid}`, { ...patient, assignedDoctorId: 'doctor_b' });
    await assert.rejects(fixture.view().addClinicalNote(patient.uid, 'Review', 'Follow up'), /assigned to you or booked/);
    assert.equal(fixture.firestore.committed.length, 1);
    fixture.unmount();
  });
  await test('booked care relationships are reread before note writes', async () => {
    const fixture = providerFixture(doctor);
    fixture.firestore.store.set(`users/${doctor.uid}`, doctor);
    fixture.firestore.store.set(`users/${patient.uid}`, patient);
    fixture.firestore.store.set(`appointments/${appointment.id}`, appointment);
    fixture.firestore.emitCollection('appointments', [row(appointment.id, appointment)]);
    await fixture.view().addClinicalNote(patient.uid, 'Review', 'Follow up');
    fixture.firestore.store.set(`appointments/${appointment.id}`, { ...appointment, status: 'Cancelled' });
    await assert.rejects(fixture.view().addClinicalNote(patient.uid, 'Review', 'Follow up'), /could not be confirmed/);
    assert.equal(fixture.firestore.committed.length, 1);
    fixture.unmount();
  });
  await test('Base64 upload callback performs no duplicate storage writes', async () => {
    const fixture = providerFixture(patient);
    const record = { id: 'upload_a', patientId: patient.uid, fileData: 'data:application/pdf;base64,fixture' };
    await fixture.view().addMedicalRecord(record);
    await fixture.view().addMedicalRecord({ ...record, fileData: undefined, downloadUrl: record.fileData });
    assert.equal(fixture.firestore.transactionCalls, 0);
    assert.equal(fixture.firestore.committed.length, 0);
    await assert.rejects(fixture.view().addMedicalRecord({ ...record, patientId: 'patient_b' }), /own health records/);
    fixture.unmount();
  });
  await test('auth profile switches suppress stale identity data and local role escalation', () => {
    const fixture = authFixture();
    fixture.emit({ uid: patient.uid, email: patient.email });
    fixture.firestore.emitDocument(`users/${patient.uid}`, { ...patient, uid: 'forged_uid' });
    assert.equal(fixture.view().currentUser.uid, patient.uid);
    fixture.view().setRole('Doctor');
    assert.equal(fixture.view().role, 'patient');
    const oldListener = fixture.firestore.active().find(item => item.target.path === `users/${patient.uid}`);
    fixture.emit({ uid: 'patient_b', email: 'patient-b@example.invalid' });
    assert.equal(fixture.view().currentUser, null);
    oldListener.receive({ exists: () => true, data: () => patient });
    assert.equal(fixture.view().currentUser, null);
    fixture.firestore.emitDocument('users/patient_b', { role: 'patient', fullName: 'Patient B' });
    assert.equal(fixture.view().currentUser.uid, 'patient_b');
    fixture.emit(null);
    assert.equal(fixture.view().currentUser, null);
    assert.equal(fixture.firestore.active().length, 0);
    fixture.unmount();
  });
  await test('auth profile failures show errors without fabricated user data', () => {
    const fixture = authFixture();
    fixture.emit({ uid: patient.uid, email: patient.email });
    fixture.firestore.emitDocument(`users/${patient.uid}`, undefined);
    assert.equal(fixture.view().currentUser, null);
    assert.ok(fixture.view().authError);
    const listener = fixture.firestore.active().find(item => item.target.path === `users/${patient.uid}`);
    listener.fail(new Error('Mock permission failure'));
    assert.equal(fixture.view().currentUser, null);
    assert.ok(fixture.view().authError);
    fixture.unmount();
  });
  console.log(`PASS ${passed} data/auth scenarios; all external modules and service calls mocked.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
