<script setup>
import { computed, ref } from 'vue';
import {
  apiCatalog,
  events,
  getApiGroups,
  getEventStream,
  getLiveStreams,
  getPlatformMetrics,
  stages,
  videoStreams,
} from './platformModel.js';

const initialView = new URLSearchParams(window.location.search).get('view');
const view = ref(['command', 'analytics', 'config', 'mobile'].includes(initialView) ? initialView : 'command');
const activeEventId = ref(events[0].id);
const activeStreamId = ref(events[0].cameraId);
const phoneTab = ref('event');

const activeEvent = computed(() => events.find((event) => event.id === activeEventId.value));
const activeStream = computed(() => getEventStream(activeEvent.value, videoStreams));
const liveStreams = computed(() => getLiveStreams(videoStreams));
const apiGroups = computed(() => getApiGroups(apiCatalog));
const metrics = computed(() => getPlatformMetrics(events, videoStreams));

const stageBars = computed(() => stages.map((stage, index) => ({
  name: stage,
  count: events.filter((event) => event.stage === index).length,
})));

const severityRows = computed(() => [
  { label: '严重', value: events.filter((event) => event.severity === 'critical').length, tone: 'critical' },
  { label: '警告', value: events.filter((event) => event.severity === 'warning').length, tone: 'warning' },
  { label: '一般', value: events.filter((event) => event.severity === 'normal').length, tone: 'normal' },
]);

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
</script>

<template>
  <div class="app" :class="{ 'mobile-view': view === 'mobile' }">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">盾</span>
        <div>
          <strong>安防 AIoT 联动中枢</strong>
          <small>高保真原型平台</small>
        </div>
      </div>
      <div class="live-badge"><span></span>{{ metrics.totalEvents }} 起事件 · {{ metrics.liveStreams }} 路实时流 · {{ metrics.apiReserved }} 个 API 预留</div>
      <nav class="view-tabs">
        <button :class="{ active: view === 'command' }" @click="view = 'command'">指挥看板</button>
        <button :class="{ active: view === 'analytics' }" @click="view = 'analytics'">统计分析</button>
        <button :class="{ active: view === 'config' }" @click="view = 'config'">视频/API配置</button>
        <button :class="{ active: view === 'mobile' }" @click="view = 'mobile'">手机端</button>
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
          <div class="kpi blue"><span>实时视频流</span><strong>{{ metrics.liveStreams }}</strong><small>已启用</small></div>
          <div class="kpi green"><span>平均置信度</span><strong>{{ metrics.averageConfidence }}%</strong><small>视觉识别</small></div>
        </div>

        <div class="stage-layout">
          <section class="panel monitor-panel">
            <div class="panel-head">
              <h2>实时监控画面</h2>
              <span>{{ activeStream.protocol }} · {{ activeStream.resolution }} · {{ activeStream.latency }}</span>
            </div>
            <div class="live-monitor" :class="activeEvent.risk.type">
              <div class="monitor-grid"></div>
              <div class="scan-line"></div>
              <div class="camera-chip top-left">CAM-A01</div>
              <div class="camera-chip top-right">CAM-C05</div>
              <div class="camera-chip bottom-left">CAM-B03</div>
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
          <div class="panel-head"><h2>视频流状态</h2><span>配置驱动</span></div>
          <button v-for="stream in liveStreams" :key="stream.id" class="stream-row" :class="{ active: stream.id === activeStreamId }" @click="selectStream(stream)">
            <b>{{ stream.id }}</b>
            <span>{{ stream.name }}</span>
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
        <div class="analysis-card"><h2>实时视频流</h2><strong>{{ metrics.liveStreams }}</strong><p>视频流配置页已预留协议、地址和认证配置。</p></div>
        <div class="analysis-card wide">
          <h2>AI 处置阶段分布</h2>
          <div class="stage-chart">
            <div v-for="item in stageBars" :key="item.name"><em><i :style="{ height: `${Math.max(item.count / metrics.totalEvents * 100, 4)}%` }"></i></em><b>{{ item.count }}</b><span>{{ item.name }}</span></div>
          </div>
        </div>
        <div class="analysis-card"><h2>后端 API 预留</h2><strong>{{ apiGroups.backend.length }}</strong><p>事件、视频流、联动、通知等接口契约。</p></div>
        <div class="analysis-card"><h2>智能体 API 预留</h2><strong>{{ apiGroups.agent.length }}</strong><p>风险、视觉、处置方案、总结智能体。</p></div>
      </section>
    </main>

    <main v-if="view === 'config'" class="config-page">
      <section class="panel config-hero">
        <div>
          <span>INTEGRATION CONFIG</span>
          <h1>监控视频流与 API 接入配置</h1>
          <p>这里预留给后续真实后端：视频流协议、推流地址、认证配置、后端 REST API 和智能体调用 API 均已抽象成配置表。</p>
        </div>
      </section>
      <section class="config-grid">
        <div class="panel wide">
          <div class="panel-head"><h2>监控视频流配置</h2><span>{{ liveStreams.length }} 路启用</span></div>
          <div class="table-list">
            <div v-for="stream in videoStreams" :key="stream.id" class="table-row">
              <b>{{ stream.id }}</b>
              <span>{{ stream.name }}</span>
              <code>{{ stream.protocol }}</code>
              <code>{{ stream.endpoint }}</code>
              <i :class="stream.status">{{ stream.enabled ? stream.status : 'disabled' }}</i>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>后端 API 预留</h2><span>{{ apiGroups.backend.length }}</span></div>
          <div v-for="api in apiGroups.backend" :key="api.id" class="api-card">
            <b>{{ api.method }} {{ api.path }}</b>
            <span>{{ api.name }}</span>
            <small>{{ api.payload }}</small>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h2>智能体 API 预留</h2><span>{{ apiGroups.agent.length }}</span></div>
          <div v-for="api in apiGroups.agent" :key="api.id" class="api-card agent">
            <b>{{ api.method }} {{ api.path }}</b>
            <span>{{ api.name }}</span>
            <small>{{ api.payload }}</small>
          </div>
        </div>
      </section>
    </main>

    <main v-if="view === 'mobile'" class="mobile-page">
      <section class="phone">
        <header><span>10:37</span><span>5G 89%</span></header>
        <div class="phone-title"><b>安防值班</b><i :class="activeEvent.severity">{{ activeEvent.severityText }}</i></div>
        <div class="phone-tabs">
          <button :class="{ active: phoneTab === 'event' }" @click="phoneTab = 'event'">事件</button>
          <button :class="{ active: phoneTab === 'stream' }" @click="phoneTab = 'stream'">画面</button>
          <button :class="{ active: phoneTab === 'api' }" @click="phoneTab = 'api'">API</button>
        </div>
        <div class="phone-body">
          <template v-if="phoneTab === 'event'">
            <div class="mobile-alert" :class="activeEvent.severity">
              <b>{{ activeEvent.title }}</b>
              <span>{{ activeEvent.location }}</span>
              <span>{{ activeEvent.cameraId }} · {{ activeEvent.confidence }}%</span>
            </div>
            <p>{{ activeEvent.aiDecision }}</p>
          </template>
          <template v-if="phoneTab === 'stream'">
            <div class="mobile-monitor" :class="activeEvent.risk.type"><span>{{ activeStream.id }} · {{ activeStream.protocol }}</span></div>
            <div class="stack-row"><b>{{ activeStream.name }}</b><span>{{ activeStream.endpoint }}</span><i :class="activeStream.status">{{ activeStream.status }}</i></div>
          </template>
          <template v-if="phoneTab === 'api'">
            <div v-for="api in apiCatalog.slice(0, 5)" :key="api.id" class="api-card"><b>{{ api.method }}</b><span>{{ api.path }}</span><small>{{ api.name }}</small></div>
          </template>
        </div>
        <footer><button>确认</button><button>派发</button><button>呼叫</button></footer>
      </section>
    </main>
  </div>
</template>
