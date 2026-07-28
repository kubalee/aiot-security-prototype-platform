<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import StreamPlayer from './StreamPlayer.vue';
import {
  getApiGroups,
  getEventStream,
  getLiveStreams,
  getPlatformMetrics,
  removeById,
  upsertById,
} from './platformModel.js';

const dataVersion = '2026-07-28-live-json-v4';
const storageKeys = {
  streams: 'aiot-security.streams.playback.v1',
  apis: 'aiot-security.apis',
  version: 'aiot-security.data-version',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

function clearStaleStorage() {
  if (window.localStorage.getItem(storageKeys.version) === dataVersion) return;
  window.localStorage.removeItem(storageKeys.streams);
  window.localStorage.removeItem(storageKeys.apis);
  window.localStorage.setItem(storageKeys.version, dataVersion);
}

function normalizeStream(stream) {
  const protocol = stream.protocol || 'RTSP';
  return {
    playProtocol: protocol === 'HLS' ? 'hls' : protocol === 'FLV' ? 'flv' : protocol === 'WebRTC' ? 'webrtc' : 'hls',
    playUrl: protocol === 'HLS' || protocol === 'WebRTC' ? stream.endpoint : '',
    ...stream,
  };
}

function maskUrl(url = '') {
  return url.replace(/:\/\/([^:@/\s]+):([^@/\s]+)@/u, '://$1:******@');
}

function formatPayload(payload) {
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload);
}

function formatJson(payload) {
  if (!payload || (Array.isArray(payload) && !payload.length)) return '{}';
  return JSON.stringify(payload, null, 2);
}

function methodTone(method = '') {
  return method.toLowerCase().replace(/[^a-z]/g, '-') || 'get';
}

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

function mergeLocalPrimaryStream(streams) {
  const envEndpoint = import.meta.env?.VITE_PRIMARY_RTSP_URL || '';
  const envPlayUrl = import.meta.env?.VITE_PRIMARY_PLAY_URL || 'http://127.0.0.1:5177/hls/cam-a01/index.m3u8';
  const envSnapshotUrl = import.meta.env?.VITE_PRIMARY_SNAPSHOT_URL || 'http://127.0.0.1:5177/snapshot/cam-a01.jpg';
  return streams.map((stream) => {
    if (stream.id !== 'CAM-A01') return normalizeStream(stream);
    return normalizeStream({
      ...stream,
      endpoint: envEndpoint || stream.endpoint,
      playProtocol: 'hls',
      playUrl: envPlayUrl,
      snapshotUrl: envSnapshotUrl,
      enabled: true,
      status: 'online',
    });
  });
}

const validViews = ['command', 'analytics', 'interfaces', 'config'];
const initialView = new URLSearchParams(window.location.search).get('view');
const view = ref(validViews.includes(initialView) ? initialView : 'command');
const loading = ref(true);
const operator = ref({ name: '-', role: '-', time: '--:--:--' });
const stages = ref([]);
const incidents = ref([]);
const activeEventId = ref('');
const activeStreamId = ref('');
const configuredStreams = ref([]);
const configuredApis = ref([]);
const editingStreamId = ref('');
const editingApiId = ref('');
const videoInfoPinned = ref(false);
const apiMockPayload = ref({ interfaces: [], flows: [], summary: {} });
const activeInterfaceId = ref('');

const streamForm = reactive({
  id: '',
  name: '',
  zone: '',
  protocol: 'RTSP',
  endpoint: '',
  playProtocol: 'hls',
  playUrl: '',
  status: 'online',
  priority: 1,
  enabled: true,
  latency: '180ms',
  bitrate: '4Mbps',
  resolution: '1920x1080',
  authProfile: '',
});

const apiForm = reactive({
  id: '',
  group: 'backend',
  method: 'POST',
  path: '',
  name: '',
  payload: '',
});

watch(configuredStreams, (streams) => {
  if (streams.length) window.localStorage.setItem(storageKeys.streams, JSON.stringify(streams));
}, { deep: true });

watch(configuredApis, (apis) => {
  if (apis.length) window.localStorage.setItem(storageKeys.apis, JSON.stringify(apis));
}, { deep: true });

const activeEvent = computed(() => incidents.value.find((event) => event.id === activeEventId.value) || incidents.value[0] || {});
const activeStream = computed(() => (
  configuredStreams.value.find((stream) => stream.id === activeStreamId.value)
  || getEventStream(activeEvent.value, configuredStreams.value)
  || configuredStreams.value[0]
  || {}
));
const liveStreams = computed(() => getLiveStreams(configuredStreams.value));
const apiGroups = computed(() => getApiGroups(configuredApis.value));
const metrics = computed(() => getPlatformMetrics(incidents.value, configuredStreams.value, configuredApis.value));
const stageBars = computed(() => stages.value.map((stage, index) => ({
  name: stage,
  count: incidents.value.filter((event) => event.stage === index).length,
  active: index <= (activeEvent.value.stage ?? -1),
})));
const severityRows = computed(() => [
  { label: '严重', value: incidents.value.filter((event) => event.severity === 'critical').length, tone: 'critical' },
  { label: '警告', value: incidents.value.filter((event) => event.severity === 'warning').length, tone: 'warning' },
  { label: '在线/一般', value: incidents.value.filter((event) => event.severity === 'normal').length, tone: 'normal' },
]);
const commandStats = computed(() => [
  { label: '事件总量', value: metrics.value.totalEvents, hint: '接口事件', tone: 'cyan' },
  { label: '实时视频', value: metrics.value.liveStreams, hint: '启用流', tone: 'blue' },
  { label: '联动进度', value: `${metrics.value.activeLinkage}/${metrics.value.totalLinkage}`, hint: '设备动作', tone: 'green' },
  { label: '通知触达', value: `${metrics.value.touchedContacts}/${metrics.value.totalContacts}`, hint: '人员回执', tone: 'amber' },
]);
const apiReadiness = computed(() => [
  { label: '后端接口', value: apiGroups.value.backend.length, hint: '事件 / 视频 / 联动 / 通知' },
  { label: '智能体接口', value: apiGroups.value.agent.length, hint: '视觉 / 风险 / 方案' },
  { label: 'JSON 契约', value: apiMockPayload.value.interfaces.length || 4, hint: 'dashboard / streams / api / mocks' },
]);
const interfaceContracts = computed(() => apiMockPayload.value.interfaces || []);
const activeInterface = computed(() => (
  interfaceContracts.value.find((item) => item.id === activeInterfaceId.value)
  || interfaceContracts.value[0]
  || {}
));
const interfaceGroups = computed(() => interfaceContracts.value.reduce((groups, item) => {
  const key = item.domain || item.group || 'other';
  if (!groups[key]) groups[key] = [];
  groups[key].push(item);
  return groups;
}, {}));
const interfaceStats = computed(() => {
  const items = interfaceContracts.value;
  return [
    { label: '接口总数', value: items.length, hint: '可交付契约' },
    { label: '后端接口', value: items.filter((item) => item.group === 'backend').length, hint: '/api/*' },
    { label: '智能体接口', value: items.filter((item) => item.group === 'agent').length, hint: '/agents/*' },
    { label: '调用链路', value: apiMockPayload.value.flows?.length || 0, hint: '业务流程' },
  ];
});

function resetStreamForm() {
  Object.assign(streamForm, {
    id: `CAM-${String(configuredStreams.value.length + 1).padStart(3, '0')}`,
    name: '',
    zone: '',
    protocol: 'RTSP',
    endpoint: '',
    playProtocol: 'hls',
    playUrl: '',
    status: 'online',
    priority: configuredStreams.value.length + 1,
    enabled: true,
    latency: '180ms',
    bitrate: '4Mbps',
    resolution: '1920x1080',
    authProfile: '',
  });
  editingStreamId.value = '';
}

function editStream(stream) {
  Object.assign(streamForm, normalizeStream(clone(stream)));
  editingStreamId.value = stream.id;
}

function saveStream() {
  const nextStream = {
    ...clone(streamForm),
    id: streamForm.id.trim(),
    name: streamForm.name.trim(),
    zone: streamForm.zone.trim(),
    endpoint: streamForm.endpoint.trim(),
    playUrl: streamForm.playUrl.trim(),
    authProfile: streamForm.authProfile.trim(),
    priority: Number(streamForm.priority) || configuredStreams.value.length + 1,
    enabled: Boolean(streamForm.enabled),
  };
  if (!nextStream.id || !nextStream.name || !nextStream.endpoint) return;
  const source = editingStreamId.value && editingStreamId.value !== nextStream.id
    ? removeById(configuredStreams.value, editingStreamId.value)
    : configuredStreams.value;
  configuredStreams.value = upsertById(source, nextStream);
  activeStreamId.value = nextStream.id;
  resetStreamForm();
}

function deleteStream(id) {
  configuredStreams.value = removeById(configuredStreams.value, id);
  if (activeStreamId.value === id) activeStreamId.value = getLiveStreams(configuredStreams.value)[0]?.id || configuredStreams.value[0]?.id || '';
}

function toggleStream(stream) {
  configuredStreams.value = upsertById(configuredStreams.value, { ...stream, enabled: !stream.enabled });
}

function resetApiForm(group = 'backend') {
  Object.assign(apiForm, {
    id: `${group}-${Date.now()}`,
    group,
    method: 'POST',
    path: group === 'backend' ? '/api/' : '/agents/',
    name: '',
    payload: '',
  });
  editingApiId.value = '';
}

function editApi(api) {
  Object.assign(apiForm, { ...clone(api), payload: formatPayload(api.payload) });
  editingApiId.value = api.id;
}

function saveApi() {
  const nextApi = {
    ...clone(apiForm),
    id: apiForm.id.trim(),
    path: apiForm.path.trim(),
    name: apiForm.name.trim(),
    payload: apiForm.payload.trim(),
  };
  if (!nextApi.id || !nextApi.path || !nextApi.name) return;
  const source = editingApiId.value && editingApiId.value !== nextApi.id
    ? removeById(configuredApis.value, editingApiId.value)
    : configuredApis.value;
  configuredApis.value = upsertById(source, nextApi);
  resetApiForm(nextApi.group);
}

function deleteApi(id) {
  configuredApis.value = removeById(configuredApis.value, id);
}

function restoreDefaults() {
  window.localStorage.removeItem(storageKeys.streams);
  window.localStorage.removeItem(storageKeys.apis);
  loadPageData();
}

function selectEvent(event) {
  activeEventId.value = event.id;
  if (event.cameraId) activeStreamId.value = event.cameraId;
}

function selectStream(stream) {
  activeStreamId.value = stream.id;
  videoInfoPinned.value = false;
  const event = incidents.value.find((item) => item.cameraId === stream.id);
  if (event) activeEventId.value = event.id;
}

function selectInterface(item) {
  activeInterfaceId.value = item.id;
}

function stageState(index) {
  if (index < activeEvent.value.stage) return 'done';
  if (index === activeEvent.value.stage) return 'active';
  return '';
}

async function loadPageData() {
  loading.value = true;
  clearStaleStorage();
  const [dashboard, streamPayload, apiPayload, mockPayload] = await Promise.all([
    fetchJson('/api/dashboard.json', { operator: {}, stages: [], incidents: [] }),
    fetchJson('/api/video-streams.json', { streams: [] }),
    fetchJson('/api/api-catalog.json', { apis: [] }),
    fetchJson('/api/api-mocks.json', { interfaces: [], flows: [], summary: {} }),
  ]);

  operator.value = dashboard.operator || operator.value;
  stages.value = dashboard.stages || [];
  incidents.value = dashboard.incidents || [];

  const apiStreams = mergeLocalPrimaryStream(streamPayload.streams || []);
  const storedStreams = readStorage(storageKeys.streams, apiStreams).map(normalizeStream);
  const storedApis = readStorage(storageKeys.apis, apiPayload.apis || []);
  configuredStreams.value = mergeLocalPrimaryStream(storedStreams.length ? storedStreams : apiStreams);
  configuredApis.value = storedApis.length ? storedApis : apiPayload.apis || [];
  apiMockPayload.value = mockPayload;
  activeEventId.value = incidents.value[0]?.id || '';
  activeStreamId.value = incidents.value[0]?.cameraId || configuredStreams.value[0]?.id || '';
  activeInterfaceId.value = mockPayload.interfaces?.[0]?.id || '';
  resetStreamForm();
  resetApiForm();
  loading.value = false;
}

onMounted(loadPageData);
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">安</span>
        <div>
          <strong>安防 AIoT 联动中枢</strong>
          <small>事件接入 · 智能研判 · 联动通知</small>
        </div>
      </div>

      <div class="live-badge">
        <span></span>{{ loading ? '正在读取本地 JSON 接口' : `${metrics.totalEvents} 条事件 · ${metrics.liveStreams} 路视频 · ${metrics.apiReserved} 个接口` }}
      </div>

      <nav class="view-tabs" aria-label="页面切换">
        <button :class="{ active: view === 'command' }" @click="view = 'command'">指挥</button>
        <button :class="{ active: view === 'analytics' }" @click="view = 'analytics'">分析</button>
        <button :class="{ active: view === 'interfaces' }" @click="view = 'interfaces'">接口</button>
        <button :class="{ active: view === 'config' }" @click="view = 'config'">配置</button>
      </nav>

      <div class="operator">
        <span>当前值班</span>
        <strong>{{ operator.name }}</strong>
        <small>{{ operator.role }} · {{ operator.time }}</small>
      </div>
    </header>

    <section v-if="loading" class="panel loading-panel">正在加载 /api/dashboard.json、/api/video-streams.json、/api/api-catalog.json...</section>

    <main v-if="!loading && view === 'command'" class="command-workspace minimal-workspace">
      <div class="ambient-grid" aria-hidden="true"></div>
      <aside class="panel situation-panel">
        <div class="section-title">
          <span>事件队列</span>
          <strong>{{ incidents.length }}</strong>
        </div>
        <button
          v-for="event in incidents"
          :key="event.id"
          class="event-row"
          :class="{ active: event.id === activeEvent.id }"
          @click="selectEvent(event)"
        >
          <i :class="event.severity"></i>
          <div>
            <strong>{{ event.title }}</strong>
            <span>{{ event.location }}</span>
          </div>
          <b>{{ event.confidence }}%</b>
        </button>

        <div class="mini-section">
          <span>视频流</span>
          <button
            v-for="stream in liveStreams"
            :key="stream.id"
            class="stream-pill"
            :class="{ active: stream.id === activeStream.id }"
            @click="selectStream(stream)"
          >
            <i :class="stream.status"></i>
            <strong>{{ stream.id }}</strong>
            <small>{{ stream.zone }}</small>
          </button>
        </div>
      </aside>

      <section class="panel live-stage">
        <div class="live-monitor">
          <StreamPlayer :stream="activeStream" />
          <div class="stage-identity">
            <span>实时指挥台</span>
            <h1>{{ activeEvent.title || '等待事件上报' }}</h1>
            <p>{{ activeEvent.location }} · {{ activeEvent.time }}</p>
          </div>
          <b class="status-pill stage-status" :class="activeEvent.severity">{{ activeEvent.severityText || '待上报' }}</b>
          <div class="video-info-panel" :class="{ pinned: videoInfoPinned }">
            <button
              class="video-info-trigger"
              type="button"
              :aria-pressed="videoInfoPinned"
              @click="videoInfoPinned = !videoInfoPinned"
            >
              {{ videoInfoPinned ? '收起信息' : '视频信息' }}
            </button>
            <div class="video-info-grid">
              <div><span>视频源</span><strong>{{ activeStream.id }} · {{ activeStream.name }}</strong></div>
              <div><span>原始流</span><code>{{ maskUrl(activeStream.endpoint) }}</code></div>
              <div><span>播放协议</span><strong>{{ activeStream.playProtocol || '未配置' }}</strong></div>
              <div><span>播放地址</span><code>{{ activeStream.playUrl ? maskUrl(activeStream.playUrl) : '等待 HLS / FLV / WebRTC 地址' }}</code></div>
            </div>
          </div>
        </div>

        <div class="stat-strip">
          <div v-for="item in commandStats" :key="item.label" class="metric-tile" :class="item.tone">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </div>
        </div>
      </section>

      <aside class="panel response-panel">
        <div class="section-title">
          <span>AI 研判</span>
          <strong>{{ activeEvent.id }}</strong>
        </div>
        <p class="decision-copy">{{ activeEvent.aiDecision }}</p>

        <div class="timeline">
          <div v-for="(stage, index) in stages" :key="stage" :class="stageState(index)">
            <b>{{ index + 1 }}</b>
            <span>{{ stage }}</span>
          </div>
        </div>

        <div class="action-list">
          <span>建议动作</span>
          <button v-for="item in activeEvent.recommendations || []" :key="item">{{ item }}</button>
        </div>
      </aside>

      <section class="panel signal-panel">
        <div class="section-title">
          <span>识别与接口信号</span>
          <strong>{{ activeEvent.confidence }}%</strong>
        </div>
        <div v-for="item in activeEvent.detections || []" :key="item.label" class="meter-row">
          <span>{{ item.label }}</span>
          <div><i :style="{ width: `${item.confidence}%` }"></i></div>
          <b>{{ item.confidence }}%</b>
        </div>
      </section>

      <section class="panel linkage-panel">
        <div class="section-title">
          <span>物联系统联动</span>
          <strong>{{ metrics.activeLinkage }}/{{ metrics.totalLinkage }}</strong>
        </div>
        <div v-for="item in activeEvent.linkage || []" :key="`${item.name}-${item.target}`" class="table-row compact">
          <div><strong>{{ item.name }}</strong><span>{{ item.target }}</span></div>
          <b :class="item.status">{{ item.label }}</b>
        </div>
      </section>

      <section class="panel contact-panel">
        <div class="section-title">
          <span>人员通知</span>
          <strong>{{ metrics.touchedContacts }}/{{ metrics.totalContacts }}</strong>
        </div>
        <div v-for="item in activeEvent.contacts || []" :key="`${item.name}-${item.channel}`" class="table-row compact">
          <div><strong>{{ item.name }}</strong><span>{{ item.role }} · {{ item.channel }}</span></div>
          <b :class="item.status">{{ item.label }}</b>
        </div>
      </section>
    </main>

    <main v-if="!loading && view === 'analytics'" class="analytics-page">
      <section class="page-intro">
        <span>DATA ANALYTICS</span>
        <h1>联动效率与接入质量</h1>
        <p>从事件、视频、物联系统、人员通知和接口契约五个维度看平台状态。</p>
      </section>

      <section class="analysis-grid">
        <div class="analysis-card"><h2>事件总量</h2><strong>{{ metrics.totalEvents }}</strong><p>来自本地 JSON 或后端事件接口。</p></div>
        <div class="analysis-card"><h2>平均置信度</h2><strong>{{ metrics.averageConfidence }}%</strong><p>按当前事件队列实时计算。</p></div>
        <div class="analysis-card"><h2>实时视频流</h2><strong>{{ metrics.liveStreams }}</strong><p>由接入配置中的启用状态计算。</p></div>
        <div class="analysis-card"><h2>接口准备度</h2><strong>{{ metrics.apiReserved }}</strong><p>后端接口与智能体接口总数。</p></div>
        <div class="analysis-card wide">
          <h2>处置阶段分布</h2>
          <div v-for="stage in stageBars" :key="stage.name" class="meter-row">
            <span>{{ stage.name }}</span>
            <div><i :style="{ width: `${Math.max(stage.count, 0.1) * 20}%` }"></i></div>
            <b>{{ stage.count }}</b>
          </div>
        </div>
        <div class="analysis-card wide">
          <h2>事件等级分布</h2>
          <div v-for="row in severityRows" :key="row.label" class="table-row compact">
            <div><strong>{{ row.label }}</strong><span>{{ row.tone }}</span></div>
            <b>{{ row.value }}</b>
          </div>
        </div>
      </section>
    </main>

    <main v-if="!loading && view === 'interfaces'" class="interfaces-page">
      <section class="page-intro interface-intro">
        <div>
          <span>API MOCK CENTER</span>
          <h1>接口模拟与后端契约</h1>
          <p>当前没有真实接口时，前端读取 `public/api/api-mocks.json`。后端后续按这里的路径、入参和返回字段实现即可。</p>
        </div>
        <a class="ghost-button" href="/api/api-mocks.json" target="_blank" rel="noreferrer">查看原始 JSON</a>
      </section>

      <section class="readiness-strip">
        <div v-for="item in interfaceStats" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.hint }}</small>
        </div>
      </section>

      <section class="api-workspace">
        <aside class="panel api-sidebar">
          <div class="section-title">
            <span>接口分组</span>
            <strong>{{ interfaceContracts.length }}</strong>
          </div>
          <div v-for="(items, domain) in interfaceGroups" :key="domain" class="api-group">
            <b>{{ domain }}</b>
            <button
              v-for="item in items"
              :key="item.id"
              class="api-contract-row"
              :class="{ active: activeInterface.id === item.id }"
              @click="selectInterface(item)"
            >
              <span :class="['method-chip', methodTone(item.method)]">{{ item.method }}</span>
              <div>
                <strong>{{ item.name }}</strong>
                <small>{{ item.path }}</small>
              </div>
            </button>
          </div>
        </aside>

        <section class="panel api-detail">
          <div class="section-title">
            <span>{{ activeInterface.name || '接口详情' }}</span>
            <strong>{{ activeInterface.id }}</strong>
          </div>
          <div class="api-heading">
            <span :class="['method-chip', methodTone(activeInterface.method)]">{{ activeInterface.method }}</span>
            <code>{{ activeInterface.path }}</code>
          </div>
          <p class="decision-copy">{{ activeInterface.description }}</p>

          <div class="api-meta-grid">
            <div>
              <span>类型</span>
              <strong>{{ activeInterface.group }}</strong>
            </div>
            <div>
              <span>领域</span>
              <strong>{{ activeInterface.domain }}</strong>
            </div>
            <div>
              <span>页面使用</span>
              <strong>{{ (activeInterface.usedBy || []).join(' / ') }}</strong>
            </div>
          </div>

          <div class="api-json-grid">
            <div>
              <h2>请求示例</h2>
              <pre>{{ formatJson(activeInterface.requestExample || activeInterface.query) }}</pre>
            </div>
            <div>
              <h2>响应示例</h2>
              <pre>{{ formatJson(activeInterface.responseExample) }}</pre>
            </div>
          </div>

          <div class="api-table-grid">
            <div>
              <h2>字段说明</h2>
              <div v-for="field in activeInterface.fields || []" :key="field.name" class="table-row api-field-row">
                <div><strong>{{ field.name }}</strong><span>{{ field.note }}</span></div>
                <b>{{ field.type }}{{ field.required ? ' · 必填' : '' }}</b>
              </div>
            </div>
            <div>
              <h2>状态码</h2>
              <div v-for="status in activeInterface.statusCodes || []" :key="status.code" class="table-row api-field-row">
                <div><strong>{{ status.code }}</strong><span>{{ status.meaning }}</span></div>
              </div>
            </div>
          </div>
        </section>

        <aside class="panel api-flow-panel">
          <div class="section-title">
            <span>调用链路</span>
            <strong>{{ apiMockPayload.version }}</strong>
          </div>
          <div v-for="flow in apiMockPayload.flows || []" :key="flow.id" class="api-flow">
            <strong>{{ flow.name }}</strong>
            <ol>
              <li v-for="step in flow.steps" :key="step">{{ step }}</li>
            </ol>
          </div>
        </aside>
      </section>
    </main>

    <main v-if="!loading && view === 'config'" class="config-page">
      <section class="page-intro config-intro">
        <div>
          <span>INTEGRATION GOVERNANCE</span>
          <h1>接入治理与接口预留</h1>
          <p>页面内容由 `public/api` 的 JSON 驱动；后端按同样字段返回即可替换成本地接口。</p>
        </div>
        <button class="ghost-button" @click="restoreDefaults">恢复默认配置</button>
      </section>

      <section class="readiness-strip">
        <div v-for="item in apiReadiness" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.hint }}</small>
        </div>
      </section>

      <section class="config-grid">
        <div class="panel editor-panel">
          <div class="section-title"><span>{{ editingStreamId ? '编辑视频流' : '新增视频流' }}</span><strong>stream</strong></div>
          <form class="config-form" @submit.prevent="saveStream">
            <label>流 ID<input v-model.trim="streamForm.id" required></label>
            <label>名称<input v-model.trim="streamForm.name" required></label>
            <label>区域<input v-model.trim="streamForm.zone"></label>
            <label>协议<select v-model="streamForm.protocol"><option>RTSP</option><option>HLS</option><option>WebRTC</option><option>FLV</option></select></label>
            <label class="span-2">原始流地址<input v-model.trim="streamForm.endpoint" required placeholder="rtsp:// 或 https:// 或 webrtc://"></label>
            <label>播放协议<select v-model="streamForm.playProtocol"><option value="hls">hls</option><option value="flv">flv</option><option value="mpegts">mpegts</option><option value="webrtc">webrtc</option></select></label>
            <label>优先级<input v-model.number="streamForm.priority" type="number" min="1"></label>
            <label class="span-2">网页播放地址<input v-model.trim="streamForm.playUrl" placeholder="浏览器可播放的 HLS / FLV / WebRTC 地址"></label>
            <label>认证配置<input v-model.trim="streamForm.authProfile" placeholder="edge-box-token"></label>
            <label class="switch-row"><input v-model="streamForm.enabled" type="checkbox">启用该视频流</label>
            <div class="form-actions span-2">
              <button type="submit">{{ editingStreamId ? '保存视频流' : '添加视频流' }}</button>
              <button type="button" class="ghost-button" @click="resetStreamForm">清空</button>
            </div>
          </form>
        </div>

        <div class="panel editor-panel">
          <div class="section-title"><span>{{ editingApiId ? '编辑 API' : '新增 API' }}</span><strong>api</strong></div>
          <form class="config-form" @submit.prevent="saveApi">
            <label>API ID<input v-model.trim="apiForm.id" required></label>
            <label>类型<select v-model="apiForm.group"><option value="backend">后端 API</option><option value="agent">智能体 API</option></select></label>
            <label>方法<input v-model.trim="apiForm.method"></label>
            <label>名称<input v-model.trim="apiForm.name" required></label>
            <label class="span-2">路径<input v-model.trim="apiForm.path" required></label>
            <label class="span-2">载荷<textarea v-model.trim="apiForm.payload" rows="4"></textarea></label>
            <div class="form-actions span-2">
              <button type="submit">{{ editingApiId ? '保存 API' : '添加 API' }}</button>
              <button type="button" class="ghost-button" @click="resetApiForm(apiForm.group)">清空</button>
            </div>
          </form>
        </div>

        <div class="panel wide">
          <div class="section-title"><span>监控视频流</span><strong>{{ liveStreams.length }} / {{ configuredStreams.length }}</strong></div>
          <div v-for="stream in configuredStreams" :key="stream.id" class="table-row config-row" :class="{ active: stream.id === activeStream.id }">
            <button class="stream-line" @click="selectStream(stream)">
              <i :class="stream.status"></i>
              <div><strong>{{ stream.id }} · {{ stream.name }}</strong><span>{{ stream.zone }} · {{ stream.protocol }} · {{ stream.resolution }}</span></div>
            </button>
            <code>{{ maskUrl(stream.endpoint) }}</code>
            <code>{{ stream.playProtocol }} · {{ stream.playUrl ? maskUrl(stream.playUrl) : '未配置播放地址' }}</code>
            <div class="form-actions">
              <button class="ghost-button" @click="editStream(stream)">编辑</button>
              <button class="ghost-button" @click="toggleStream(stream)">{{ stream.enabled ? '停用' : '启用' }}</button>
              <button class="ghost-button" @click="deleteStream(stream.id)">删除</button>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="section-title"><span>后端 API</span><strong>{{ apiGroups.backend.length }}</strong></div>
          <div v-for="api in apiGroups.backend" :key="api.id" class="table-row api-row">
            <div><strong>{{ api.method }} {{ api.path }}</strong><span>{{ api.name }}</span><small>{{ formatPayload(api.payload) }}</small></div>
            <div class="form-actions"><button class="ghost-button" @click="editApi(api)">编辑</button><button class="ghost-button" @click="deleteApi(api.id)">删除</button></div>
          </div>
        </div>

        <div class="panel">
          <div class="section-title"><span>智能体 API</span><strong>{{ apiGroups.agent.length }}</strong></div>
          <div v-for="api in apiGroups.agent" :key="api.id" class="table-row api-row">
            <div><strong>{{ api.method }} {{ api.path }}</strong><span>{{ api.name }}</span><small>{{ formatPayload(api.payload) }}</small></div>
            <div class="form-actions"><button class="ghost-button" @click="editApi(api)">编辑</button><button class="ghost-button" @click="deleteApi(api.id)">删除</button></div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
