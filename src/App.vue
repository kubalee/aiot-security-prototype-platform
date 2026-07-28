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

const dataVersion = '2026-07-28-live-json-v2';
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

const initialView = new URLSearchParams(window.location.search).get('view');
const view = ref(['command', 'analytics', 'config'].includes(initialView) ? initialView : 'command');
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
})));
const severityRows = computed(() => [
  { label: '严重', value: incidents.value.filter((event) => event.severity === 'critical').length, tone: 'critical' },
  { label: '警告', value: incidents.value.filter((event) => event.severity === 'warning').length, tone: 'warning' },
  { label: '一般/在线', value: incidents.value.filter((event) => event.severity === 'normal').length, tone: 'normal' },
]);

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
  const event = incidents.value.find((item) => item.cameraId === stream.id);
  if (event) activeEventId.value = event.id;
}

function stageState(index) {
  if (index < activeEvent.value.stage) return 'done';
  if (index === activeEvent.value.stage) return 'active';
  return '';
}

async function loadPageData() {
  loading.value = true;
  clearStaleStorage();
  const [dashboard, streamPayload, apiPayload] = await Promise.all([
    fetchJson('/api/dashboard.json', { operator: {}, stages: [], incidents: [] }),
    fetchJson('/api/video-streams.json', { streams: [] }),
    fetchJson('/api/api-catalog.json', { apis: [] }),
  ]);

  operator.value = dashboard.operator || operator.value;
  stages.value = dashboard.stages || [];
  incidents.value = dashboard.incidents || [];

  const apiStreams = mergeLocalPrimaryStream(streamPayload.streams || []);
  const storedStreams = readStorage(storageKeys.streams, apiStreams).map(normalizeStream);
  const storedApis = readStorage(storageKeys.apis, apiPayload.apis || []);
  configuredStreams.value = mergeLocalPrimaryStream(storedStreams.length ? storedStreams : apiStreams);
  configuredApis.value = storedApis.length ? storedApis : apiPayload.apis || [];
  activeEventId.value = incidents.value[0]?.id || '';
  activeStreamId.value = incidents.value[0]?.cameraId || configuredStreams.value[0]?.id || '';
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
          <small>可运行前端配置平台</small>
        </div>
      </div>
      <div class="live-badge">
        <span></span>{{ loading ? '正在加载接口 JSON' : `${metrics.totalEvents} 条事件 · ${metrics.liveStreams} 路启用流 · ${metrics.apiReserved} 个 API 配置` }}
      </div>
      <nav class="view-tabs">
        <button :class="{ active: view === 'command' }" @click="view = 'command'">指挥看板</button>
        <button :class="{ active: view === 'analytics' }" @click="view = 'analytics'">统计分析</button>
        <button :class="{ active: view === 'config' }" @click="view = 'config'">接入配置</button>
      </nav>
      <div class="operator">值班：{{ operator.name }} · {{ operator.time }}</div>
    </header>

    <section v-if="loading" class="panel loading-panel">正在加载 /api/dashboard.json、/api/video-streams.json、/api/api-catalog.json...</section>

    <main v-if="!loading && view === 'command'" class="command-grid">
      <section class="panel hero-card">
        <div class="panel-head">
          <div>
            <p>AI 事件处置</p>
            <h1>{{ activeEvent.title || '等待事件上报' }}</h1>
          </div>
          <span class="status-pill" :class="activeEvent.severity">{{ activeEvent.severityText || '待上报' }}</span>
        </div>

        <div class="kpi-row">
          <div class="kpi critical"><span>严重事件</span><strong>{{ metrics.criticalEvents }}</strong><small>需立即处置</small></div>
          <div class="kpi"><span>处理中</span><strong>{{ metrics.processingEvents }}</strong><small>跨系统跟进</small></div>
          <div class="kpi blue"><span>实时视频流</span><strong>{{ metrics.liveStreams }}</strong><small>配置驱动</small></div>
          <div class="kpi green"><span>平均置信度</span><strong>{{ metrics.averageConfidence }}%</strong><small>AI 复核结果</small></div>
        </div>

        <div class="live-monitor">
          <StreamPlayer :stream="activeStream" />
          <footer>
            <div><span>当前视频源</span><strong>{{ activeStream.id }} · {{ activeStream.name }}</strong></div>
            <div><span>原始流</span><code>{{ maskUrl(activeStream.endpoint) }}</code></div>
            <div><span>网页播放</span><strong>{{ activeStream.playProtocol || '未配置' }}</strong></div>
            <div><span>播放地址</span><code>{{ activeStream.playUrl ? maskUrl(activeStream.playUrl) : '等待 HLS / FLV / WebRTC 地址' }}</code></div>
          </footer>
        </div>
      </section>

      <section class="panel event-list">
        <div class="panel-head"><h2>事件队列</h2><span>{{ incidents.length }}</span></div>
        <button v-for="event in incidents" :key="event.id" class="event-row" :class="{ active: event.id === activeEvent.id }" @click="selectEvent(event)">
          <i :class="event.severity"></i>
          <div><strong>{{ event.title }}</strong><span>{{ event.location }} · {{ event.time }}</span></div>
          <b>{{ event.confidence }}%</b>
        </button>
      </section>

      <section class="panel detail-panel">
        <div class="panel-head"><h2>AI 决策</h2><span>{{ activeEvent.id }}</span></div>
        <p class="decision-copy">{{ activeEvent.aiDecision }}</p>
        <div class="flow">
          <div v-for="(stage, index) in stages" :key="stage" class="flow-step" :class="stageState(index)">
            <b>{{ index + 1 }}</b>
            <span>{{ stage }}</span>
          </div>
        </div>
        <div class="recommendations">
          <strong>建议动作</strong>
          <span v-for="item in activeEvent.recommendations || []" :key="item">{{ item }}</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>识别结果</h2><span>{{ activeEvent.confidence }}%</span></div>
        <div v-for="item in activeEvent.detections || []" :key="item.label" class="meter-row">
          <span>{{ item.label }}</span>
          <div><i :style="{ width: `${item.confidence}%` }"></i></div>
          <b>{{ item.confidence }}%</b>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>物联系统联动</h2><span>{{ metrics.activeLinkage }}/{{ metrics.totalLinkage }}</span></div>
        <div v-for="item in activeEvent.linkage || []" :key="`${item.name}-${item.target}`" class="table-row">
          <div><strong>{{ item.name }}</strong><span>{{ item.target }}</span></div>
          <b :class="item.status">{{ item.label }}</b>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>人员通知</h2><span>{{ metrics.touchedContacts }}/{{ metrics.totalContacts }}</span></div>
        <div v-for="item in activeEvent.contacts || []" :key="`${item.name}-${item.channel}`" class="table-row">
          <div><strong>{{ item.name }}</strong><span>{{ item.role }} · {{ item.channel }}</span></div>
          <b :class="item.status">{{ item.label }}</b>
        </div>
      </section>
    </main>

    <main v-if="!loading && view === 'analytics'" class="config-page">
      <section class="config-hero">
        <span>DATA ANALYTICS</span>
        <h1>安防 AI 联动统计分析</h1>
        <p>从 AI 事件、实时视频流、物联系统联动、人员通知和 API 接入准备度五个维度评估平台状态。</p>
      </section>

      <section class="analysis-grid">
        <div class="analysis-card"><h2>事件总量</h2><strong>{{ metrics.totalEvents }}</strong><p>来自本地 JSON 或后端事件接口。</p></div>
        <div class="analysis-card"><h2>平均置信度</h2><strong>{{ metrics.averageConfidence }}%</strong><p>按当前事件队列实时计算。</p></div>
        <div class="analysis-card"><h2>实时视频流</h2><strong>{{ metrics.liveStreams }}</strong><p>由接入配置中的启用状态计算。</p></div>
        <div class="analysis-card"><h2>API 配置</h2><strong>{{ metrics.apiReserved }}</strong><p>后端接口与智能体接口总数。</p></div>
        <div class="analysis-card wide">
          <h2>事件阶段分布</h2>
          <div v-for="stage in stageBars" :key="stage.name" class="meter-row">
            <span>{{ stage.name }}</span>
            <div><i :style="{ width: `${Math.max(stage.count, 0.1) * 20}%` }"></i></div>
            <b>{{ stage.count }}</b>
          </div>
        </div>
        <div class="analysis-card wide">
          <h2>事件等级分布</h2>
          <div v-for="row in severityRows" :key="row.label" class="table-row">
            <div><strong>{{ row.label }}</strong><span>{{ row.tone }}</span></div>
            <b>{{ row.value }}</b>
          </div>
        </div>
      </section>
    </main>

    <main v-if="!loading && view === 'config'" class="config-page">
      <section class="config-hero">
        <span>INTEGRATION CONFIG</span>
        <h1>监控视频流与 API 接入配置</h1>
        <p>默认数据来自 public/api 下的 JSON 文件。后端保持相同字段结构后，可直接切换成真实接口。</p>
        <button class="ghost-button" @click="restoreDefaults">恢复默认配置</button>
      </section>

      <section class="config-grid">
        <div class="panel">
          <div class="panel-head"><h2>{{ editingStreamId ? '编辑视频流' : '新增视频流' }}</h2><span>stream config</span></div>
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

        <div class="panel">
          <div class="panel-head"><h2>{{ editingApiId ? '编辑 API' : '新增 API' }}</h2><span>api config</span></div>
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
          <div class="panel-head"><h2>监控视频流配置</h2><span>{{ liveStreams.length }} 路启用 / {{ configuredStreams.length }} 路总配置</span></div>
          <div v-for="stream in configuredStreams" :key="stream.id" class="table-row config-row" :class="{ active: stream.id === activeStream.id }">
            <button class="stream-row" @click="selectStream(stream)">
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
          <div class="panel-head"><h2>后端 API 配置</h2><span>{{ apiGroups.backend.length }}</span></div>
          <div v-for="api in apiGroups.backend" :key="api.id" class="table-row">
            <div><strong>{{ api.method }} {{ api.path }}</strong><span>{{ api.name }}</span><small>{{ formatPayload(api.payload) }}</small></div>
            <div class="form-actions"><button class="ghost-button" @click="editApi(api)">编辑</button><button class="ghost-button" @click="deleteApi(api.id)">删除</button></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>智能体 API 配置</h2><span>{{ apiGroups.agent.length }}</span></div>
          <div v-for="api in apiGroups.agent" :key="api.id" class="table-row">
            <div><strong>{{ api.method }} {{ api.path }}</strong><span>{{ api.name }}</span><small>{{ formatPayload(api.payload) }}</small></div>
            <div class="form-actions"><button class="ghost-button" @click="editApi(api)">编辑</button><button class="ghost-button" @click="deleteApi(api.id)">删除</button></div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
