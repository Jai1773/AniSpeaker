import axios from 'axios';

const PORT = process.env.PORT || '8788';
const BASE_URL = `http://localhost:${PORT}`;
const API_URL = `${BASE_URL}/api`;

const pass = (name: string) => console.log(`✅ ${name}`);
const fail = (name: string, e: any) => {
  console.error(`❌ ${name} FAILED: ${e.message}`);
  if (e.response) {
    console.error(`   HTTP ${e.response.status} → ${JSON.stringify(e.response.data)}`);
  }
  process.exit(1);
};

const test = async (name: string, fn: () => Promise<any>) => {
  try { await fn(); pass(name); }
  catch (e: any) { fail(name, e); }
};

async function main() {
  console.log(`🚀 AniSpeaker Full Integration Test Suite on ${BASE_URL}\n`);

  let token = '';
  let contentId = '';
  let contentSlug = '';
  let episodeId = '';

  // ── Health ──────────────────────────────────────────────────────────────────
  await test('GET / → 200 "AniSpeaker API is running!"', async () => {
    const r = await axios.get(BASE_URL);
    if (r.data !== 'AniSpeaker API is running!') throw new Error('Wrong response body');
  });

  // ── Auth ────────────────────────────────────────────────────────────────────
  const email = `test-${Date.now()}@example.com`;
  const password = 'Test@1234';

  await test('POST /api/auth/register → 201 with token', async () => {
    const r = await axios.post(`${API_URL}/auth/register`, { email, password, displayName: 'Integration Tester' });
    if (r.status !== 201) throw new Error(`Expected 201, got ${r.status}`);
    if (!r.data.token) throw new Error('No token in response');
    token = r.data.token;
    if (r.data.user.email.toLowerCase() !== email.toLowerCase()) throw new Error('Email mismatch');
    if (r.data.user.role !== 'User') throw new Error('Role should be User');
  });

  await test('POST /api/auth/register → 400 on duplicate email', async () => {
    const r = await axios.post(`${API_URL}/auth/register`, { email, password }, { validateStatus: () => true });
    if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
  });

  await test('POST /api/auth/login → 200 with token', async () => {
    const r = await axios.post(`${API_URL}/auth/login`, { email, password });
    if (!r.data.token) throw new Error('No token returned');
    token = r.data.token;
  });

  await test('POST /api/auth/login → 401 on wrong password', async () => {
    const r = await axios.post(`${API_URL}/auth/login`, { email, password: 'wrongpassword' }, { validateStatus: () => true });
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
  });

  // ── Public Content ──────────────────────────────────────────────────────────
  await test('GET /api/content → 200 array (paginated)', async () => {
    const r = await axios.get(`${API_URL}/content?page=1&pageSize=50`);
    if (!Array.isArray(r.data)) throw new Error('Expected array');
    if (r.data.length === 0) throw new Error('Expected at least 1 item');
    const first = r.data[0];
    contentId = first.id;
    contentSlug = first.slug;
    if (!first.id || !first.title || !first.slug || !first.type) throw new Error('Missing required fields');
    if (!Array.isArray(first.tags)) throw new Error('tags must be an array');
    console.log(`   → ${r.data.length} items. First: "${first.title}" (type: ${first.type})`);
  });

  await test('GET /api/content?type=Movie → only Movies', async () => {
    const r = await axios.get(`${API_URL}/content?type=Movie`);
    if (!Array.isArray(r.data)) throw new Error('Expected array');
    const nonMovies = r.data.filter((x: any) => x.type.toLowerCase() !== 'movie');
    if (nonMovies.length > 0) throw new Error(`Found non-movie items: ${nonMovies.map((x: any) => x.type)}`);
    console.log(`   → ${r.data.length} movies`);
  });

  await test('GET /api/content?type=Series → only Series', async () => {
    const r = await axios.get(`${API_URL}/content?type=Series`);
    if (!Array.isArray(r.data)) throw new Error('Expected array');
    const nonSeries = r.data.filter((x: any) => x.type.toLowerCase() !== 'series');
    if (nonSeries.length > 0) throw new Error(`Found non-series items: ${nonSeries.map((x: any) => x.type)}`);
    console.log(`   → ${r.data.length} series`);
  });

  // ── Search ──────────────────────────────────────────────────────────────────
  await test('GET /api/search?q=solo → results array', async () => {
    const r = await axios.get(`${API_URL}/search?q=solo`);
    if (!Array.isArray(r.data)) throw new Error('Expected array');
    console.log(`   → ${r.data.length} result(s) for "solo"`);
  });

  await test('GET /api/search?q= → empty array (no query)', async () => {
    const r = await axios.get(`${API_URL}/search?q=`);
    if (!Array.isArray(r.data) || r.data.length !== 0) throw new Error('Expected empty array');
  });

  // ── Content Detail ──────────────────────────────────────────────────────────
  await test(`GET /api/content/${contentSlug} → detail with seasons & episodes`, async () => {
    const r = await axios.get(`${API_URL}/content/${encodeURIComponent(contentSlug)}`);
    if (!r.data.id || !r.data.title) throw new Error('Missing id or title');
    if (!Array.isArray(r.data.seasons)) throw new Error('seasons must be array');
    if (!Array.isArray(r.data.episodes)) throw new Error('episodes must be array');
    if (r.data.episodes.length > 0) {
      episodeId = r.data.episodes[0].id;
    }
    console.log(`   → "${r.data.title}": ${r.data.seasons.length} season(s), ${r.data.episodes.length} episode(s)`);
  });

  await test('GET /api/content/nonexistent-slug-xyz → 404', async () => {
    const r = await axios.get(`${API_URL}/content/nonexistent-slug-xyz-abc-def`, { validateStatus: () => true });
    if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
  });

  // ── Playback ────────────────────────────────────────────────────────────────
  if (episodeId) {
    await test(`GET /api/playback/${episodeId} → sources array`, async () => {
      const r = await axios.get(`${API_URL}/playback/${episodeId}`);
      if (!r.data.sources || !Array.isArray(r.data.sources)) throw new Error('sources must be array');
      if (!r.data.episodeId) throw new Error('Missing episodeId in response');
      console.log(`   → ${r.data.sources.length} active source(s). First player: ${r.data.sources[0]?.playerName}`);
    });
  }

  await test('GET /api/playback/00000000-0000-0000-0000-000000000000 → 404', async () => {
    const r = await axios.get(`${API_URL}/playback/00000000-0000-0000-0000-000000000000`, { validateStatus: () => true });
    if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
  });

  // ── Admin ───────────────────────────────────────────────────────────────────
  await test('GET /api/admin/categories → array of categories', async () => {
    const r = await axios.get(`${API_URL}/admin/categories`);
    if (!Array.isArray(r.data)) throw new Error('Expected array');
    if (r.data.length === 0) throw new Error('Expected at least 1 category');
    console.log(`   → ${r.data.length} categories`);
  });

  await test('GET /api/admin/content → PageResult with items, page, pageSize, totalCount', async () => {
    const r = await axios.get(`${API_URL}/admin/content`);
    if (!Array.isArray(r.data.items)) throw new Error('Expected items array');
    if (typeof r.data.totalCount !== 'number') throw new Error('Expected totalCount number');
    console.log(`   → ${r.data.totalCount} total items, ${r.data.items.length} on page ${r.data.page}`);
  });

  await test('GET /api/admin/content?search=shinchan → filtered results', async () => {
    const r = await axios.get(`${API_URL}/admin/content?search=shinchan`);
    if (!Array.isArray(r.data.items)) throw new Error('Expected items array');
    console.log(`   → ${r.data.items.length} result(s) for "shinchan"`);
  });

  // ── Account — Auth required ─────────────────────────────────────────────────
  await test('GET /api/account/watch-later without auth → 401', async () => {
    const r = await axios.get(`${API_URL}/account/watch-later`, { validateStatus: () => true });
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
  });

  await test('GET /api/account/watch-later with auth → 200 array', async () => {
    const r = await axios.get(`${API_URL}/account/watch-later`, { headers: { Authorization: `Bearer ${token}` } });
    if (!Array.isArray(r.data)) throw new Error('Expected array');
  });

  await test('POST /api/account/watch-later → add item', async () => {
    const r = await axios.post(
      `${API_URL}/account/watch-later`,
      { contentId },
      { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );
    if (r.status !== 201 && r.status !== 400) throw new Error(`Expected 201 or 400, got ${r.status}`);
  });

  await test('POST /api/account/watch-later → 404 on invalid contentId', async () => {
    const r = await axios.post(
      `${API_URL}/account/watch-later`,
      { contentId: '00000000-0000-0000-0000-000000000000' },
      { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );
    if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
  });

  await test('DELETE /api/account/watch-later/:contentId → remove item', async () => {
    const r = await axios.delete(
      `${API_URL}/account/watch-later/${contentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.data.success) throw new Error('Expected success: true');
  });

  if (episodeId) {
    await test('POST /api/account/history → save progress', async () => {
      const r = await axios.post(
        `${API_URL}/account/history`,
        { episodeId, progressSeconds: 120 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.data.success) throw new Error('Expected success: true');
    });

    await test('GET /api/account/history → returns history with progress', async () => {
      const r = await axios.get(`${API_URL}/account/history`, { headers: { Authorization: `Bearer ${token}` } });
      if (!Array.isArray(r.data) || r.data.length === 0) throw new Error('Expected non-empty array');
      const entry = r.data.find((h: any) => h.episodeId === episodeId);
      if (!entry) throw new Error('Could not find history entry for test episode');
      if (entry.progressSeconds !== 120) throw new Error(`Expected progressSeconds 120, got ${entry.progressSeconds}`);
    });

    await test('POST /api/account/history → 404 on invalid episodeId', async () => {
      const r = await axios.post(
        `${API_URL}/account/history`,
        { episodeId: '00000000-0000-0000-0000-000000000000', progressSeconds: 0 },
        { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
      );
      if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
    });
  }

  console.log(`\n✨ ALL TESTS PASSED — Backend on ${BASE_URL} is fully connected to Neon PostgreSQL.`);
}

main().catch(err => {
  console.error('\n💥 Test suite crashed:', err.message);
  process.exit(1);
});
