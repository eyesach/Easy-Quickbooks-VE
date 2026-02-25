/**
 * SyncService Test Suite
 *
 * Tests the collaborative group file sharing module using an in-memory
 * mock backend. Open sync.test.html in a browser to run.
 */

// ==================== MINI TEST FRAMEWORK ====================

const TestRunner = {
    results: [],
    currentSuite: '',
    _queue: [],

    suite(name) {
        this.currentSuite = name;
    },

    test(name, fn) {
        const suiteName = this.currentSuite;
        this._queue.push(async () => {
            try {
                await fn();
                this.results.push({ suite: suiteName, name, passed: true });
            } catch (err) {
                this.results.push({ suite: suiteName, name, passed: false, error: err.message });
            }
        });
    },

    async runAll() {
        for (const testFn of this._queue) {
            await testFn();
        }
        this.render();
    },

    assertEqual(actual, expected, msg = '') {
        if (actual !== expected) {
            throw new Error(`${msg ? msg + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    },

    assertTrue(value, msg = '') {
        if (!value) throw new Error(`${msg ? msg + ': ' : ''}Expected truthy, got ${JSON.stringify(value)}`);
    },

    assertFalse(value, msg = '') {
        if (value) throw new Error(`${msg ? msg + ': ' : ''}Expected falsy, got ${JSON.stringify(value)}`);
    },

    async assertThrows(fn, msg = '') {
        try {
            await fn();
            throw new Error(`${msg ? msg + ': ' : ''}Expected function to throw, but it did not`);
        } catch (err) {
            if (err.message.includes('Expected function to throw')) throw err;
            return err;
        }
    },

    render() {
        const container = document.getElementById('results');
        const suites = {};
        this.results.forEach(r => {
            if (!suites[r.suite]) suites[r.suite] = [];
            suites[r.suite].push(r);
        });

        let html = '';
        for (const [suiteName, tests] of Object.entries(suites)) {
            html += `<div class="suite"><div class="suite-title">${suiteName}</div>`;
            tests.forEach(t => {
                html += `<div class="test ${t.passed ? 'pass' : 'fail'}">${t.name}</div>`;
                if (!t.passed) {
                    html += `<div class="error-detail">${t.error}</div>`;
                }
            });
            html += `</div>`;
        }
        container.innerHTML = html;

        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        const summaryEl = document.getElementById('summary');
        summaryEl.className = `summary ${failed > 0 ? 'has-fail' : 'all-pass'}`;
        summaryEl.textContent = `${passed}/${total} passed, ${failed} failed`;
    }
};

// ==================== MOCK BACKEND ====================

/**
 * In-memory mock that simulates the server API.
 * Stores groups, versions, and members — no network involved.
 */
function createMockApi() {
    const groups = {};
    let nextGroupId = 1;

    return {
        _groups: groups,

        async createGroup(name) {
            const groupId = `group-${nextGroupId++}`;
            groups[groupId] = {
                name,
                members: [],
                versions: [],
                createdAt: new Date().toISOString()
            };
            return { groupId, name, createdAt: groups[groupId].createdAt };
        },

        async joinGroup(groupId, user) {
            const group = groups[groupId];
            if (!group) throw new Error('Group not found');
            if (!group.members.includes(user)) group.members.push(user);
            const currentVersion = group.versions.length > 0
                ? group.versions[group.versions.length - 1].version
                : 0;
            return { groupId, name: group.name, members: [...group.members], currentVersion };
        },

        async pushVersion(groupId, data) {
            const group = groups[groupId];
            if (!group) throw new Error('Group not found');

            const currentVersion = group.versions.length > 0
                ? group.versions[group.versions.length - 1].version
                : 0;

            // Optimistic locking: reject if base version doesn't match current
            if (data.baseVersion !== currentVersion) {
                const err = new Error('Version conflict: remote has v' + currentVersion + ', you have v' + data.baseVersion);
                err.name = 'ConflictError';
                err.code = 'VERSION_CONFLICT';
                err.remoteVersion = currentVersion;
                throw err;
            }

            const newVersion = currentVersion + 1;
            group.versions.push({
                version: newVersion,
                data: new Uint8Array(data.blob), // copy the blob
                savedBy: data.user,
                savedAt: new Date().toISOString(),
                sizeBytes: data.blob.length
            });

            return { version: newVersion };
        },

        async pullLatest(groupId) {
            const group = groups[groupId];
            if (!group) throw new Error('Group not found');
            if (group.versions.length === 0) return null;

            const latest = group.versions[group.versions.length - 1];
            return {
                version: latest.version,
                data: new Uint8Array(latest.data),
                savedBy: latest.savedBy,
                savedAt: latest.savedAt
            };
        },

        async getHistory(groupId, limit = 20) {
            const group = groups[groupId];
            if (!group) throw new Error('Group not found');
            return group.versions
                .slice(-limit)
                .reverse()
                .map(v => ({
                    version: v.version,
                    savedBy: v.savedBy,
                    savedAt: v.savedAt,
                    sizeBytes: v.sizeBytes
                }));
        },

        async pullVersion(groupId, version) {
            const group = groups[groupId];
            if (!group) throw new Error('Group not found');
            const entry = group.versions.find(v => v.version === version);
            if (!entry) throw new Error('Version not found');
            return {
                version: entry.version,
                data: new Uint8Array(entry.data),
                savedBy: entry.savedBy,
                savedAt: entry.savedAt
            };
        }
    };
}

// ==================== HELPERS ====================

function fakeBlob(content = 'test-data') {
    return new TextEncoder().encode(content);
}

function resetSync() {
    SyncService._reset();
    SyncService.api = createMockApi();
}

// ==================== TESTS ====================

(async function runAllTests() {
    const T = TestRunner;

    // ---- Group Management ----

    T.suite('Group Management');

        T.test('createGroup returns a group ID and sets state', async () => {
            resetSync();
            const result = await SyncService.createGroup('Test Corp', 'Alice');
            T.assertTrue(result.groupId, 'should return groupId');
            T.assertEqual(result.name, 'Test Corp');
            T.assertEqual(SyncService.groupId, result.groupId);
            T.assertEqual(SyncService.currentUser, 'Alice');
            T.assertTrue(SyncService.isConnected);
            T.assertEqual(SyncService.localVersion, 0);
        });

        T.test('joinGroup connects to existing group', async () => {
            resetSync();
            const created = await SyncService.createGroup('Team A', 'Alice');
            // Push an initial version so there's a version to track
            await SyncService.push(fakeBlob('v1-data'));

            // Reset and join as Bob
            SyncService._reset();
            SyncService.api = createMockApi(); // need same api instance
            // Actually, we need the same mock. Let's redo:
            resetSync();
            const group = await SyncService.createGroup('Team A', 'Alice');
            await SyncService.push(fakeBlob('v1'));
            const gid = group.groupId;
            const api = SyncService.api; // keep same backend

            SyncService._reset();
            SyncService.api = api;
            const joinResult = await SyncService.joinGroup(gid, 'Bob');
            T.assertEqual(joinResult.groupId, gid);
            T.assertEqual(joinResult.name, 'Team A');
            T.assertEqual(joinResult.currentVersion, 1);
            T.assertEqual(SyncService.currentUser, 'Bob');
            T.assertTrue(SyncService.isConnected);
        });

        T.test('joinGroup with invalid ID throws', async () => {
            resetSync();
            await T.assertThrows(
                () => SyncService.joinGroup('nonexistent', 'Alice'),
                'should throw for invalid group'
            );
        });

        T.test('disconnect clears state', async () => {
            resetSync();
            await SyncService.createGroup('Test', 'Alice');
            SyncService.disconnect();
            T.assertFalse(SyncService.isConnected);
            T.assertEqual(SyncService.groupId, null);
            T.assertEqual(SyncService.localVersion, 0);
        });

    // ---- Push / Pull ----

    T.suite('Push & Pull');

        T.test('push saves a version and increments localVersion', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            T.assertEqual(SyncService.localVersion, 0);

            const result = await SyncService.push(fakeBlob('first-save'));
            T.assertEqual(result.version, 1);
            T.assertFalse(result.conflict);
            T.assertEqual(SyncService.localVersion, 1);
        });

        T.test('push multiple versions increments correctly', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');

            await SyncService.push(fakeBlob('v1'));
            await SyncService.push(fakeBlob('v2'));
            const r3 = await SyncService.push(fakeBlob('v3'));

            T.assertEqual(r3.version, 3);
            T.assertEqual(SyncService.localVersion, 3);
        });

        T.test('pull returns latest version with correct data', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('hello-world'));

            // Simulate another client pulling
            const api = SyncService.api;
            SyncService._reset();
            SyncService.api = api;
            SyncService.groupId = 'group-1';
            SyncService.localVersion = 0;
            SyncService.isConnected = true;

            const result = await SyncService.pull();
            T.assertTrue(result.updated);
            T.assertEqual(result.version, 1);
            T.assertEqual(result.savedBy, 'Alice');
            const text = new TextDecoder().decode(result.data);
            T.assertEqual(text, 'hello-world');
            T.assertEqual(SyncService.localVersion, 1);
        });

        T.test('pull returns updated=false when already at latest', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('data'));

            // Already at v1, pull should say no update
            const result = await SyncService.pull();
            T.assertFalse(result.updated);
            T.assertEqual(result.version, 1);
        });

        T.test('pull on empty group returns updated=false', async () => {
            resetSync();
            await SyncService.createGroup('Empty', 'Alice');
            const result = await SyncService.pull();
            T.assertFalse(result.updated);
            T.assertEqual(result.data, null);
        });

        T.test('push without group throws', async () => {
            resetSync();
            await T.assertThrows(
                () => SyncService.push(fakeBlob()),
                'should throw when not in a group'
            );
        });

        T.test('pull without group throws', async () => {
            resetSync();
            await T.assertThrows(
                () => SyncService.pull(),
                'should throw when not in a group'
            );
        });

        T.test('push without api throws', async () => {
            SyncService._reset();
            SyncService.groupId = 'fake';
            await T.assertThrows(
                () => SyncService.push(fakeBlob()),
                'should throw when api not set'
            );
        });

    // ---- Conflict Detection ----

    T.suite('Conflict Detection');

        T.test('concurrent edits cause a conflict on the stale client', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('initial'));
            // Alice is at v1

            const api = SyncService.api;
            const gid = SyncService.groupId;

            // Bob joins, pulls v1, then pushes v2
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Bob');
            await SyncService.push(fakeBlob('bob-edit'));
            T.assertEqual(SyncService.localVersion, 2);

            // Alice (still at v1) tries to push — should get conflict
            SyncService._reset();
            SyncService.api = api;
            SyncService.groupId = gid;
            SyncService.localVersion = 1;
            SyncService.currentUser = 'Alice';
            SyncService.isConnected = true;

            const result = await SyncService.push(fakeBlob('alice-edit'));
            T.assertTrue(result.conflict, 'should detect conflict');
            T.assertEqual(SyncService.localVersion, 1, 'version should not advance on conflict');
        });

        T.test('onConflict callback fires on conflict', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('v1'));
            const api = SyncService.api;
            const gid = SyncService.groupId;

            // Bob pushes v2
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Bob');
            await SyncService.push(fakeBlob('v2'));

            // Alice at v1 tries to push
            let conflictFired = false;
            SyncService._reset();
            SyncService.api = api;
            SyncService.groupId = gid;
            SyncService.localVersion = 1;
            SyncService.currentUser = 'Alice';
            SyncService.isConnected = true;
            SyncService.onConflict = () => { conflictFired = true; };

            await SyncService.push(fakeBlob('alice-v2'));
            T.assertTrue(conflictFired, 'onConflict should have been called');
        });

        T.test('conflict resolution: pull then re-push succeeds', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('v1'));
            const api = SyncService.api;
            const gid = SyncService.groupId;

            // Bob pushes v2
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Bob');
            await SyncService.push(fakeBlob('bob-v2'));

            // Alice at v1 gets conflict
            SyncService._reset();
            SyncService.api = api;
            SyncService.groupId = gid;
            SyncService.localVersion = 1;
            SyncService.currentUser = 'Alice';
            SyncService.isConnected = true;

            const pushResult = await SyncService.push(fakeBlob('alice-attempt'));
            T.assertTrue(pushResult.conflict);

            // Alice pulls to get v2, then re-pushes
            await SyncService.pull();
            T.assertEqual(SyncService.localVersion, 2, 'should be at v2 after pull');

            const retryResult = await SyncService.push(fakeBlob('alice-merged'));
            T.assertFalse(retryResult.conflict);
            T.assertEqual(retryResult.version, 3);
        });

    // ---- Version History ----

    T.suite('Version History');

        T.test('getHistory returns all versions in reverse order', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('v1'));
            await SyncService.push(fakeBlob('v2'));
            await SyncService.push(fakeBlob('v3'));

            const history = await SyncService.getHistory();
            T.assertEqual(history.length, 3);
            T.assertEqual(history[0].version, 3, 'most recent first');
            T.assertEqual(history[2].version, 1, 'oldest last');
            T.assertEqual(history[0].savedBy, 'Alice');
        });

        T.test('getHistory respects limit', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            for (let i = 0; i < 10; i++) {
                await SyncService.push(fakeBlob(`v${i + 1}`));
            }
            const history = await SyncService.getHistory(3);
            T.assertEqual(history.length, 3);
            T.assertEqual(history[0].version, 10);
            T.assertEqual(history[2].version, 8);
        });

        T.test('getHistory tracks different users', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('alice-v1'));
            const api = SyncService.api;
            const gid = SyncService.groupId;

            // Bob joins and pushes
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Bob');
            await SyncService.push(fakeBlob('bob-v2'));

            const history = await SyncService.getHistory();
            T.assertEqual(history.length, 2);
            T.assertEqual(history[0].savedBy, 'Bob');
            T.assertEqual(history[1].savedBy, 'Alice');
        });

        T.test('pullVersion retrieves a specific historical version', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('version-one-data'));
            await SyncService.push(fakeBlob('version-two-data'));

            const v1 = await SyncService.pullVersion(1);
            T.assertEqual(v1.version, 1);
            T.assertEqual(new TextDecoder().decode(v1.data), 'version-one-data');

            const v2 = await SyncService.pullVersion(2);
            T.assertEqual(new TextDecoder().decode(v2.data), 'version-two-data');
        });

        T.test('pullVersion with invalid version throws', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await T.assertThrows(
                () => SyncService.pullVersion(99),
                'should throw for nonexistent version'
            );
        });

        T.test('history includes file size', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            const blob = fakeBlob('some data here');
            await SyncService.push(blob);
            const history = await SyncService.getHistory();
            T.assertEqual(history[0].sizeBytes, blob.length);
        });

    // ---- Callbacks & Status ----

    T.suite('Callbacks & Status');

        T.test('onStatusChange fires on create, push, pull', async () => {
            resetSync();
            const statuses = [];
            SyncService.onStatusChange = (e) => statuses.push(e.status);

            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('v1'));

            T.assertTrue(statuses.includes('connected'), 'should emit connected');
            T.assertTrue(statuses.includes('saved'), 'should emit saved');
        });

        T.test('onRemoteUpdate fires when pull finds a new version', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('v1'));
            const api = SyncService.api;
            const gid = SyncService.groupId;

            // Bob at v0 pulls
            SyncService._reset();
            SyncService.api = api;
            SyncService.groupId = gid;
            SyncService.localVersion = 0;
            SyncService.isConnected = true;

            let updateData = null;
            SyncService.onRemoteUpdate = (data) => { updateData = data; };

            await SyncService.pull();
            T.assertTrue(updateData !== null, 'onRemoteUpdate should fire');
            T.assertEqual(updateData.version, 1);
            T.assertEqual(updateData.savedBy, 'Alice');
            T.assertEqual(updateData.previousVersion, 0);
        });

        T.test('onRemoteUpdate does NOT fire when already current', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('v1'));

            let fired = false;
            SyncService.onRemoteUpdate = () => { fired = true; };

            await SyncService.pull();
            T.assertFalse(fired, 'should not fire when already at latest');
        });

        T.test('disconnect fires status change', async () => {
            resetSync();
            const statuses = [];
            SyncService.onStatusChange = (e) => statuses.push(e.status);

            await SyncService.createGroup('Corp', 'Alice');
            SyncService.disconnect();
            T.assertTrue(statuses.includes('disconnected'));
        });

    // ---- Multi-User Scenario ----

    T.suite('Multi-User Scenarios');

        T.test('three users take turns editing without conflicts', async () => {
            resetSync();
            await SyncService.createGroup('Finance Team', 'Alice');
            await SyncService.push(fakeBlob('alice-initial'));
            const api = SyncService.api;
            const gid = SyncService.groupId;

            // Bob pulls, edits, pushes
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Bob');
            const r2 = await SyncService.push(fakeBlob('bob-edit'));
            T.assertFalse(r2.conflict);
            T.assertEqual(r2.version, 2);

            // Charlie pulls, edits, pushes
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Charlie');
            const r3 = await SyncService.push(fakeBlob('charlie-edit'));
            T.assertFalse(r3.conflict);
            T.assertEqual(r3.version, 3);

            // Verify history shows all three
            const history = await SyncService.getHistory();
            T.assertEqual(history.length, 3);
            T.assertEqual(history[0].savedBy, 'Charlie');
            T.assertEqual(history[1].savedBy, 'Bob');
            T.assertEqual(history[2].savedBy, 'Alice');
        });

        T.test('stale user must pull before pushing', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('v1'));
            const api = SyncService.api;
            const gid = SyncService.groupId;

            // Bob joins at v1
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Bob');
            T.assertEqual(SyncService.localVersion, 1);

            // Alice pushes v2 directly via api
            await api.pushVersion(gid, { blob: fakeBlob('alice-v2'), baseVersion: 1, user: 'Alice' });

            // Bob (still at v1) tries to push — conflict
            const result = await SyncService.push(fakeBlob('bob-edit'));
            T.assertTrue(result.conflict);

            // Bob pulls v2
            const pullResult = await SyncService.pull();
            T.assertTrue(pullResult.updated);
            T.assertEqual(pullResult.version, 2);
            T.assertEqual(pullResult.savedBy, 'Alice');

            // Bob pushes successfully
            const retry = await SyncService.push(fakeBlob('bob-merged'));
            T.assertFalse(retry.conflict);
            T.assertEqual(retry.version, 3);
        });

        T.test('last editor is always tracked correctly', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            const api = SyncService.api;
            const gid = SyncService.groupId;

            // Alice pushes
            await SyncService.push(fakeBlob('a'));
            let latest = await api.pullLatest(gid);
            T.assertEqual(latest.savedBy, 'Alice');

            // Bob pushes
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Bob');
            await SyncService.push(fakeBlob('b'));
            latest = await api.pullLatest(gid);
            T.assertEqual(latest.savedBy, 'Bob');

            // Charlie pushes
            SyncService._reset();
            SyncService.api = api;
            await SyncService.joinGroup(gid, 'Charlie');
            await SyncService.push(fakeBlob('c'));
            latest = await api.pullLatest(gid);
            T.assertEqual(latest.savedBy, 'Charlie');
        });

    // ---- Edge Cases ----

    T.suite('Edge Cases');

        T.test('push with empty blob succeeds', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            const result = await SyncService.push(new Uint8Array(0));
            T.assertEqual(result.version, 1);
            T.assertFalse(result.conflict);
        });

        T.test('push with large blob preserves data', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            // 1MB blob
            const large = new Uint8Array(1024 * 1024);
            large.fill(42);
            await SyncService.push(large);

            const pulled = await SyncService.pull();
            // Already at v1, so pull won't update. Use pullVersion instead.
            const v1 = await SyncService.pullVersion(1);
            T.assertEqual(v1.data.length, 1024 * 1024);
            T.assertEqual(v1.data[0], 42);
            T.assertEqual(v1.data[1024 * 1024 - 1], 42);
        });

        T.test('_reset fully clears state', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');
            await SyncService.push(fakeBlob('data'));

            SyncService._reset();
            T.assertEqual(SyncService.groupId, null);
            T.assertEqual(SyncService.localVersion, 0);
            T.assertEqual(SyncService.currentUser, '');
            T.assertFalse(SyncService.isConnected);
            T.assertEqual(SyncService.api, null);
        });

        T.test('rapid sequential pushes all succeed', async () => {
            resetSync();
            await SyncService.createGroup('Corp', 'Alice');

            const results = [];
            for (let i = 0; i < 20; i++) {
                results.push(await SyncService.push(fakeBlob(`rapid-${i}`)));
            }
            T.assertEqual(results.length, 20);
            T.assertEqual(results[19].version, 20);
            T.assertTrue(results.every(r => !r.conflict));
        });

        T.test('history on empty group returns empty array', async () => {
            resetSync();
            await SyncService.createGroup('Empty', 'Alice');
            const history = await SyncService.getHistory();
            T.assertEqual(history.length, 0);
        });

    // ---- Run all queued tests ----
    await T.runAll();

})();
