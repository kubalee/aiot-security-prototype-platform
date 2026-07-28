<script setup>
import { computed, reactive, ref, watch } from 'vue';
import {
  apiCatalog,
  events,
  getApiGroups,
  getEventStream,
  getLiveStreams,
  getPlatformMetrics,
  removeById,
  stages,
  upsertById,
  videoStreams,
} from './platformModel.js';

const storageKeys = {
  streams: 'aiot-security.streams',
  streamsVersion: 'aiot-security.streams.version',
  apis: 'aiot-security.apis',
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

function readConfiguredStreams() {
  const streams = readStorage(storageKeys.streams, videoStreams);
  const primaryStream = videoStreams.find((stream) => stream.id === 'CAM-A01');
  if (!primaryStream) return streams;

  const appliedVersion = window.localStorage.getItem(storageKeys.streamsVersion);
  if (appliedVersion === primaryStream.endpoint) return streams;

  const mergedStreams = upsertById(streams, {
    ...primaryStream,
    enabled: true,
    status: 'online',
  });
  window.localStorage.setItem(storageKeys.streamsVersion, primaryStream.endpoint);
  window.localStorage.setItem(storageKeys.streams, JSON.stringify(mergedStreams));
  return mergedStreams;
}

const initialView = new URLSearchParams(window.location.search).get('view');
const view = ref(['command', 'analytics', 'config'].includes(initialView) ? initialView : 'command');
const activeEventId = ref(events[0].id);
const activeStreamId = ref(events[0].cameraId);
const configuredStreams = ref(readConfiguredStreams());
const configuredApis = ref(readStorage(storageKeys.apis, apiCatalog));
const editingStreamId = ref('');
const editingApiId = ref('');

const streamForm = reactive({
  id: '',
  name: '',
  zone: '',
  protocol: 'RTSP',
  endpoint: '',
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
  window.localStorage.setItem(storageKeys.streams, JSON.stringify(streams));
}, { deep: true });

watch(configuredApis, (apis) => {
  window.localStorage.setItem(storageKeys.apis, JSON.stringify(apis));
}, { deep: true });

const activeEvent = computed(() => events.find((event) => event.id === activeEventId.value) || events[0]);
const activeStream = computed(() => (
  configuredStreams.value.find((stream) => stream.id === activeStreamId.value)
  || getEventStream(activeEvent.value, configuredStreams.value)
  || configuredStreams.value[0]
  || videoStreams[0]
));
const liveStreams = computed(() => getLiveStreams(configuredStreams.value));
const apiGroups = computed(() => getApiGroups(configuredApis.value));
const metrics = computed(() => getPlatformMetrics(events, configuredStreams.value, configuredApis.value));

const stageBars = computed(() => stages.map((stage, index) => ({
  name: stage,
  count: events.filter((event) => event.stage === index).length,
})));

const severityRows = computed(() => [
  { label: '严重', value: events.filter((event) => event.severity === 'critical').length, tone: 'critical' },
  { label: '警告', value: events.filter((event) => event.severity === 'warning').length, tone: 'warning' },
  { label: '一般', value: events.filter((event) => event.severity === 'normal').length, tone: 'normal' },
]);

function resetStreamForm() {
  Object.assign(streamForm, {
    id: `CAM-${String(configuredStreams.value.length + 1).padStart(3, '0')}`,
    name: '',
    zone: '',
    protocol: 'RTSP',
    endpoint: '',
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
  Object.assign(streamForm, clone(stream));
  editingStreamId.value = stream.id;
}

function saveStream() {
  const nextStream = {
    ...clone(streamForm),
    id: streamForm.id.trim(),
    name: streamForm.name.trim(),
    zone: streamForm.zone.trim(),
    endpoint: streamForm.endpoint.trim(),
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
    method: group === 'backend' ? 'POST' : 'POST',
    path: group === 'backend' ? '/api/' : '/agents/',
    name: '',
    payload: '',
  });
  editingApiId.value = '';
}

function editApi(api) {
  Object.assign(apiForm, clone(api));
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
  configuredStreams.value = clone(videoStreams);
  configuredApis.value = clone(apiCatalog);
  window.localStorage.setItem(storageKeys.streamsVersion, videoStreams.find((stream) => stream.id === 'CAM-A01')?.endpoint || '');
  resetStreamForm();
  resetApiForm();
}

function selectEvent(event) {
  activeEventId.value = event.id;
  activeStreamId.value = event.cameraId;
}

function selectStream(stream) {
  activeStreamId.value = stream.id;
  const event = events.find((item) => item.cameraId === stream.id);
  if (event) activeEventId.value = event.id;
}

function stageState(index) {
  if (index < activeEvent.value.stage) return 'done';
  if (index === activeEvent.value.stage) return 'active';
  return '';
}

resetStreamForm();
resetApiForm();
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">盾</span>
        <div>
          <strong>安防 AIoT 联动中枢</strong>
          <small>可运行前端配置平台</small>
        </div>
      </div>
      <div class="live-badge"><span></span>{{ metrics.totalEvents }} 起事件 · {{ metrics.liveStreams }} 路启用流 · {{ metrics.apiReserved }} 个 API 配置</div>
      <nav class="view-tabs">
        <button :class="{ active: view === 'command' }" @click="view = 'command'">指挥看板</button>
        <button :class="{ active: view === 'analytics' }" @click="view = 'analytics'">统计分析</button>
        <button :class="{ active: view === 'config' }" @click="view = 'config'">接入配置</button>
      </nav>
      <div class="operator">值班：李明 · 10:37:26</div>
    </header>

    <main v-if="view === 'command'" class="command-grid">
      <aside class="panel event-panel">
        <div class="panel-head">
          <h2>AI 设备实时上报</h2>
          <span>LIVE</span>
        </div>
        <button
          v-for="event in events"
          :key="event.id"
          class="event-card"
          :class="[event.severity, { active: event.id === activeEventId }]"
          @click="selectEvent(event)"
        >
          <span class="event-title">
            <b>{{ event.title }}</b>
            <i :class="event.severity">{{ event.severityText }}</i>
          </span>
          <span>{{ event.location }}</span>
          <span class="event-meta"><code>{{ event.time }}</code><code>{{ event.cameraId }}</code></span>
          <em><span :style="{ width: `${event.progress}%` }"></span></em>
        </button>
      </aside>

      <section class="main-stage">
        <div class="kpi-row">
          <div class="kpi critical"><span>严重事件</span><strong>{{ metrics.criticalEvents }}</strong><small>需立即处置</small></div>
          <div class="kpi"><span>处理中</span><strong>{{ metrics.processingEvents }}</strong><small>AI 正在跟进</small></div>
          <div class="kpi blue"><span>实时视频流</span><strong>{{ metrics.liveStreams }}</strong><small>配置驱动</small></div>
          <div class="kpi green"><span>平均置信度</span><strong>{{ metrics.averageConfidence }}%</strong><small>视觉识别</small></div>
        </div>

        <div class="stage-layout">
          <section class="panel monitor-panel">
            <div class="panel-head">
              <h2>实时监控画面</h2>
              <span>{{ activeStream.protocol }} · {{ activeStream.resolution }} · {{ activeStream.latency }}</span>
            </div>
            <div class="video-source-strip">
              <div><span>当前视频源</span><b>{{ activeStream.id }} · {{ activeStream.name }}</b></div>
              <div><span>协议 / 状态</span><b>{{ activeStream.protocol }} · {{ activeStream.enabled ? activeStream.status : 'disabled' }}</b></div>
              <div><span>认证配置</span><b>{{ activeStream.authProfile || '未配置' }}</b></div>
              <div class="span-2"><span>原始流地址</span><code>{{ activeStream.endpoint }}</code></div>
              <small>RTSP 原始流已作为接入配置写入；浏览器真实播放通常需要后端转成 WebRTC / HLS / FLV。</small>
            </div>
            <div class="live-monitor" :class="activeEvent.risk.type">
              <div class="monitor-grid"></div>
              <div class="scan-line"></div>
              <div v-for="stream in liveStreams.slice(0, 3)" :key="stream.id" class="camera-chip" :class="stream.priority === 1 ? 'top-left' : stream.priority === 2 ? 'top-right' : 'bottom-left'">{{ stream.id }}</div>
              <div
                class="risk-box"
                :class="activeEvent.severity"
                :style="{ left: `${activeEvent.risk.x}%`, top: `${activeEvent.risk.y}%` }"
              >
                <span>{{ activeEvent.title }} · {{ activeEvent.confidence }}%</span>
              </div>
              <footer>
                <strong>{{ activeStream.id }} · {{ activeStream.name }}</strong>
                <code>{{ activeStream.endpoint }}</code>
              </footer>
            </div>
          </section>

          <section class="panel decision-panel">
            <div class="panel-head">
              <h2>平台 AI 决策</h2>
              <i :class="activeEvent.severity">{{ activeEvent.severityText }}</i>
            </div>
            <p>{{ activeEvent.aiDecision }}</p>
            <div class="recommend-list">
              <div v-for="(item, index) in activeEvent.recommendations" :key="item">
                <b>{{ index < activeEvent.stage ? '✓' : '□' }}</b>{{ item }}
              </div>
            </div>
            <div class="confidence-grid">
              <div v-for="item in activeEvent.detections" :key="item.label">
                <span>{{ item.label }} <b>{{ item.confidence }}%</b></span>
                <em><i :style="{ width: `${item.confidence}%` }"></i></em>
              </div>
            </div>
          </section>
        </div>

        <section class="panel flow-panel">
          <div class="panel-head">
            <h2>AI 处置链路</h2>
            <span>设备上报 → 智能体研判 → 物联系统/人员联动</span>
          </div>
          <div class="flow-grid">
            <div v-for="(stage, index) in stages" :key="stage" class="flow-step" :class="stageState(index)">
              <b>{{ index < activeEvent.stage ? '✓' : '□' }} {{ stage }}</b>
              <span>{{ ['边缘盒子、摄像头、传感器上报事件', '视觉复核智能体排除误报', '风险研判智能体生成等级与范围', '下发物联系统并通知人员', '复查闭环、留痕归档'][index] }}</span>
            </div>
          </div>
        </section>
      </section>

      <aside class="side-stack">
        <section class="panel">
          <div class="panel-head"><h2>视频流状态</h2><span>来自接入配置</span></div>
          <button v-for="stream in liveStreams" :key="stream.id" class="stream-row" :class="{ active: stream.id === activeStreamId }" @click="selectStream(stream)">
            <b>{{ stream.id }}</b>
            <span>{{ stream.name }} · {{ stream.protocol }}</span>
            <i :class="stream.status">{{ stream.status }}</i>
          </button>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>物联系统联动</h2><span>{{ metrics.activeLinkage }}/{{ metrics.totalLinkage }}</span></div>
          <div v-for="item in activeEvent.linkage" :key="item.name" class="stack-row">
            <b>{{ item.name }}</b><span>{{ item.target }}</span><i :class="item.status">{{ item.label }}</i>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>人员通知</h2><span>{{ metrics.touchedContacts }}/{{ metrics.totalContacts }}</span></div>
          <div v-for="item in activeEvent.contacts" :key="item.name" class="stack-row">
            <b>{{ item.name }}</b><span>{{ item.role }} · {{ item.channel }}</span><i :class="item.status">{{ item.label }}</i>
          </div>
        </section>
      </aside>
    </main>

    <main v-if="view === 'analytics'" class="analytics-page">
      <section class="hero-panel">
        <div>
          <span>OVERALL ANALYTICS</span>
          <h1>安防 AI 联动统计分析</h1>
          <p>从 AI 事件、实时视频流、物联系统联动、人员通知和 API 接入准备度五个维度评估平台状态。</p>
        </div>
        <strong>{{ Math.round((metrics.averageConfidence + metrics.activeLinkage / metrics.totalLinkage * 100 + metrics.touchedContacts / metrics.totalContacts * 100) / 3) }}</strong>
      </section>
      <section class="analysis-grid">
        <div class="analysis-card wide">
          <h2>事件风险结构</h2>
          <div v-for="row in severityRows" :key="row.label" class="bar-row" :class="row.tone">
            <span>{{ row.label }}</span><b>{{ row.value }}</b><em><i :style="{ width: `${row.value / metrics.totalEvents * 100}%` }"></i></em>
          </div>
        </div>
        <div class="analysis-card"><h2>平均置信度</h2><strong>{{ metrics.averageConfidence }}%</strong><p>来自当前事件队列的 AI 识别结果。</p></div>
        <div class="analysis-card"><h2>实时视频流</h2><strong>{{ metrics.liveStreams }}</strong><p>由接入配置中的启用状态实时计算。</p></div>
        <div class="analysis-card wide">
          <h2>AI 处置阶段分布</h2>
          <div class="stage-chart">
            <div v-for="item in stageBars" :key="item.name"><em><i :style="{ height: `${Math.max(item.count / metrics.totalEvents * 100, 4)}%` }"></i></em><b>{{ item.count }}</b><span>{{ item.name }}</span></div>
          </div>
        </div>
        <div class="analysis-card"><h2>后端 API 配置</h2><strong>{{ apiGroups.backend.length }}</strong><p>事件、视频流、联动、通知等接口契约。</p></div>
        <div class="analysis-card"><h2>智能体 API 配置</h2><strong>{{ apiGroups.agent.length }}</strong><p>风险、视觉、处置方案、总结智能体。</p></div>
      </section>
    </main>

    <main v-if="view === 'config'" class="config-page">
      <section class="panel config-hero">
        <div>
          <span>INTEGRATION CONFIG</span>
          <h1>监控视频流与 API 接入配置</h1>
          <p>配置会保存到浏览器 localStorage。修改视频流启用状态、地址、协议和 API 契约后，指挥看板和统计页会立即按配置刷新。</p>
        </div>
        <button class="ghost-button" @click="restoreDefaults">恢复默认配置</button>
      </section>

      <section class="config-editor-grid">
        <div class="panel editor-panel">
          <div class="panel-head"><h2>{{ editingStreamId ? '编辑视频流' : '新增视频流' }}</h2><span>stream config</span></div>
          <form class="config-form" @submit.prevent="saveStream">
            <label>编号<input v-model.trim="streamForm.id" required placeholder="CAM-A01"></label>
            <label>名称<input v-model.trim="streamForm.name" required placeholder="A区 1号楼大门入口"></label>
            <label>区域<input v-model.trim="streamForm.zone" placeholder="A区"></label>
            <label>协议<select v-model="streamForm.protocol"><option>RTSP</option><option>HLS</option><option>WebRTC</option><option>FLV</option></select></label>
            <label class="span-2">视频流地址<input v-model.trim="streamForm.endpoint" required placeholder="rtsp:// 或 https:// 或 webrtc://"></label>
            <label>状态<select v-model="streamForm.status"><option>online</option><option>degraded</option><option>offline</option></select></label>
            <label>优先级<input v-model.number="streamForm.priority" type="number" min="1"></label>
            <label>分辨率<input v-model.trim="streamForm.resolution" placeholder="1920x1080"></label>
            <label>延迟<input v-model.trim="streamForm.latency" placeholder="180ms"></label>
            <label>码率<input v-model.trim="streamForm.bitrate" placeholder="4Mbps"></label>
            <label>认证配置<input v-model.trim="streamForm.authProfile" placeholder="edge-box-token"></label>
            <label class="switch-row"><input v-model="streamForm.enabled" type="checkbox">启用该视频流</label>
            <div class="form-actions">
              <button type="submit">{{ editingStreamId ? '保存视频流' : '添加视频流' }}</button>
              <button type="button" class="ghost-button" @click="resetStreamForm">清空</button>
            </div>
          </form>
        </div>

        <div class="panel editor-panel">
          <div class="panel-head"><h2>{{ editingApiId ? '编辑 API' : '新增 API' }}</h2><span>backend / agent</span></div>
          <form class="config-form" @submit.prevent="saveApi">
            <label>编号<input v-model.trim="apiForm.id" required placeholder="event-ingest"></label>
            <label>类型<select v-model="apiForm.group"><option value="backend">后端 API</option><option value="agent">智能体 API</option></select></label>
            <label>方法<select v-model="apiForm.method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>GET/PUT</option></select></label>
            <label class="span-2">路径<input v-model.trim="apiForm.path" required placeholder="/api/security/events 或 /agents/risk-assessor/invoke"></label>
            <label class="span-2">名称<input v-model.trim="apiForm.name" required placeholder="AI 设备事件上报"></label>
            <label class="span-2">入参/负载<textarea v-model.trim="apiForm.payload" rows="3" placeholder="deviceId, eventType, confidence, metadata"></textarea></label>
            <div class="form-actions">
              <button type="submit">{{ editingApiId ? '保存 API' : '添加 API' }}</button>
              <button type="button" class="ghost-button" @click="resetApiForm(apiForm.group)">清空</button>
            </div>
          </form>
        </div>
      </section>

      <section class="config-grid">
        <div class="panel wide">
          <div class="panel-head"><h2>监控视频流配置</h2><span>{{ liveStreams.length }} 路启用 / {{ configuredStreams.length }} 路总配置</span></div>
          <div class="table-list">
            <div v-for="stream in configuredStreams" :key="stream.id" class="table-row config-row">
              <b>{{ stream.id }}</b>
              <span>{{ stream.name }}</span>
              <code>{{ stream.protocol }}</code>
              <code>{{ stream.endpoint }}</code>
              <i :class="stream.enabled ? stream.status : 'disabled'">{{ stream.enabled ? stream.status : 'disabled' }}</i>
              <div class="row-actions">
                <button @click="editStream(stream)">编辑</button>
                <button @click="toggleStream(stream)">{{ stream.enabled ? '停用' : '启用' }}</button>
                <button class="danger" @click="deleteStream(stream.id)">删除</button>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>后端 API 配置</h2><span>{{ apiGroups.backend.length }}</span></div>
          <div v-for="api in apiGroups.backend" :key="api.id" class="api-card">
            <b>{{ api.method }} {{ api.path }}</b>
            <span>{{ api.name }}</span>
            <small>{{ api.payload }}</small>
            <div class="row-actions">
              <button @click="editApi(api)">编辑</button>
              <button class="danger" @click="deleteApi(api.id)">删除</button>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>智能体 API 配置</h2><span>{{ apiGroups.agent.length }}</span></div>
          <div v-for="api in apiGroups.agent" :key="api.id" class="api-card agent">
            <b>{{ api.method }} {{ api.path }}</b>
            <span>{{ api.name }}</span>
            <small>{{ api.payload }}</small>
            <div class="row-actions">
              <button @click="editApi(api)">编辑</button>
              <button class="danger" @click="deleteApi(api.id)">删除</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
