const primaryRtspEndpoint = import.meta.env?.VITE_PRIMARY_RTSP_URL || 'rtsp://stream.example.local/a-zone/gate-main';
const primaryPlayEndpoint = import.meta.env?.VITE_PRIMARY_PLAY_URL || 'http://127.0.0.1:5177/hls/cam-a01/index.m3u8';
const primarySnapshotEndpoint = import.meta.env?.VITE_PRIMARY_SNAPSHOT_URL || 'http://127.0.0.1:5177/snapshot/cam-a01.jpg';

export const stages = ['设备上报', 'AI 复核', '风险决策', '联动执行', '复查闭环'];

export const events = [
  {
    id: 'EVT-001',
    title: 'A区入口摄像头在线',
    zone: 'A区',
    location: 'A区 · 1号楼大门入口',
    cameraId: 'CAM-A01',
    time: '14:40:18',
    severity: 'normal',
    severityText: '在线',
    confidence: 97.4,
    progress: 100,
    stage: 4,
    aiDecision: '平台已接入主摄像头实时画面，AI 设备上报、平台复核、物联系统联动与人员通知链路处于可验证状态。',
    recommendations: ['保持主摄像头在线', '记录视频流心跳', '同步巡检看板状态', '等待新的 AI 设备上报'],
    detections: [
      { label: '视频流心跳', confidence: 97.4 },
      { label: '设备认证状态', confidence: 95.8 },
      { label: '画面可用性', confidence: 93.2 },
      { label: '误报排除', confidence: 92.1 },
    ],
    linkage: [
      { name: '视频网关', target: 'CAM-A01', status: 'done', label: '已接入' },
      { name: 'AI 复核服务', target: '主摄像头', status: 'done', label: '已就绪' },
      { name: '通知服务', target: '值班组', status: 'done', label: '待触发' },
    ],
    contacts: [
      { name: '李明', role: '值班主管', channel: 'App', status: 'done', label: '已同步' },
      { name: '周倩', role: '运维负责人', channel: '工单', status: 'done', label: '已同步' },
    ],
  },
  {
    id: 'EVT-002',
    title: '人员闯入复核',
    zone: 'B区',
    location: 'B区 · 后门通道',
    cameraId: 'CAM-B03',
    time: '14:28:12',
    severity: 'warning',
    severityText: '警告',
    confidence: 91.2,
    progress: 100,
    stage: 4,
    aiDecision: '系统判断为非授权人员进入后门通道，已联动门禁锁定、现场广播警告，并推送给安保巡逻人员。',
    recommendations: ['锁定 B区后门', '调取最近 5 分钟回放', '通知巡逻组', '完成现场复查'],
    detections: [
      { label: '人体目标', confidence: 91.2 },
      { label: '身份未授权', confidence: 86.1 },
      { label: '门禁状态', confidence: 88.5 },
      { label: '误报排除', confidence: 87.6 },
    ],
    linkage: [
      { name: '后门门禁', target: 'B区 B-12', status: 'done', label: '已锁定' },
      { name: '现场广播', target: '后门通道', status: 'done', label: '已播报' },
      { name: '巡更系统', target: '最近巡逻点', status: 'done', label: '已派单' },
    ],
    contacts: [
      { name: '赵强', role: '巡逻队长', channel: 'App', status: 'done', label: '已接单' },
      { name: '李明', role: '值班主管', channel: 'App', status: 'done', label: '已确认' },
    ],
  },
  {
    id: 'EVT-003',
    title: '仓库环境异常复核',
    zone: 'C区',
    location: 'C区 · 仓库3号',
    cameraId: 'CAM-C05',
    time: '14:35:08',
    severity: 'warning',
    severityText: '警告',
    confidence: 82.1,
    progress: 55,
    stage: 2,
    aiDecision: '环境读数与视觉复核出现偏离，系统建议继续核对传感器、热成像与仓库门磁，并预置联动方案。',
    recommendations: ['复核传感器 C-09', '读取仓库热成像', '通知仓库主管', '准备现场巡检'],
    detections: [
      { label: '环境读数偏离', confidence: 82.1 },
      { label: '热源变化', confidence: 71.5 },
      { label: '门磁状态', confidence: 63.8 },
      { label: '误报排除', confidence: 74.9 },
    ],
    linkage: [
      { name: '环境传感器', target: 'C区 C-09', status: 'running', label: '复核中' },
      { name: '仓库门禁', target: 'C区侧门', status: 'pending', label: '待检测' },
      { name: '巡检工单', target: '仓库3号', status: 'pending', label: '待派发' },
    ],
    contacts: [
      { name: '陈晨', role: '仓库主管', channel: 'App / 短信', status: 'running', label: '待确认' },
      { name: '周倩', role: '运维负责人', channel: 'App', status: 'pending', label: '待发送' },
    ],
  },
  {
    id: 'EVT-004',
    title: '消防通道堆放',
    zone: 'A区',
    location: 'A区 · 2号楼楼梯间',
    cameraId: 'CAM-A06',
    time: '14:15:47',
    severity: 'warning',
    severityText: '警告',
    confidence: 89.3,
    progress: 40,
    stage: 2,
    aiDecision: '消防通道存在堆放物，影响疏散效率。建议通知物业清理并安排巡检机器人复查。',
    recommendations: ['创建物业清理工单', '通知楼宇管理员', '标记疏散路径风险', '巡检机器人复查'],
    detections: [
      { label: '通道堆放', confidence: 89.3 },
      { label: '通行宽度不足', confidence: 84 },
      { label: '人员聚集', confidence: 31.5 },
      { label: '误报排除', confidence: 80.7 },
    ],
    linkage: [
      { name: '工单系统', target: '物业维修', status: 'running', label: '已创建' },
      { name: '巡检机器人', target: 'A区 2号楼', status: 'pending', label: '待派发' },
    ],
    contacts: [
      { name: '王磊', role: '物业经理', channel: 'App', status: 'running', label: '待确认' },
      { name: '孙雨', role: '楼宇管理员', channel: '短信', status: 'pending', label: '待发送' },
    ],
  },
  {
    id: 'EVT-005',
    title: '设备离线恢复',
    zone: 'D区',
    location: 'D区 · 电梯间',
    cameraId: 'CAM-D02',
    time: '14:20:33',
    severity: 'normal',
    severityText: '已恢复',
    confidence: 73.4,
    progress: 100,
    stage: 4,
    aiDecision: '摄像头短时离线后已恢复，系统已补录离线窗口并创建运维记录。',
    recommendations: ['保存离线窗口日志', '检查交换机端口', '校验设备时钟', '关闭临时告警'],
    detections: [
      { label: '设备心跳恢复', confidence: 93 },
      { label: '网络质量波动', confidence: 78.4 },
      { label: '画面连续性', confidence: 70.2 },
      { label: '风险影响', confidence: 28.6 },
    ],
    linkage: [
      { name: '摄像头', target: 'CAM-D02', status: 'done', label: '已恢复' },
      { name: '运维工单', target: '网络检查', status: 'done', label: '已创建' },
    ],
    contacts: [
      { name: '刘洋', role: '运维工程师', channel: '工单', status: 'done', label: '已接收' },
    ],
  },
];

export const videoStreams = [
  {
    id: 'CAM-A01',
    name: 'A区 1号楼大门入口',
    zone: 'A区',
    protocol: 'RTSP',
    endpoint: primaryRtspEndpoint,
    playProtocol: 'hls',
    playUrl: primaryPlayEndpoint,
    snapshotUrl: primarySnapshotEndpoint,
    status: 'online',
    priority: 1,
    enabled: true,
    latency: '180ms',
    bitrate: '4.2Mbps',
    resolution: '1920x1080',
    authProfile: 'edge-box-token',
  },
  {
    id: 'CAM-C05',
    name: 'C区 仓库3号',
    zone: 'C区',
    protocol: 'RTSP',
    endpoint: 'rtsp://stream.example.local/c-zone/warehouse-3',
    playProtocol: 'hls',
    playUrl: 'https://stream.example.local/hls/c-zone/warehouse-3.m3u8',
    status: 'online',
    priority: 2,
    enabled: true,
    latency: '240ms',
    bitrate: '3.7Mbps',
    resolution: '1920x1080',
    authProfile: 'edge-box-token',
  },
  {
    id: 'CAM-B03',
    name: 'B区 后门通道',
    zone: 'B区',
    protocol: 'HLS',
    endpoint: 'https://stream.example.local/hls/b-zone/backdoor.m3u8',
    playProtocol: 'hls',
    playUrl: 'https://stream.example.local/hls/b-zone/backdoor.m3u8',
    status: 'online',
    priority: 3,
    enabled: true,
    latency: '420ms',
    bitrate: '2.8Mbps',
    resolution: '1280x720',
    authProfile: 'signed-url',
  },
  {
    id: 'CAM-A06',
    name: 'A区 2号楼楼梯间',
    zone: 'A区',
    protocol: 'WebRTC',
    endpoint: 'webrtc://stream.example.local/a-zone/stairway-2',
    playProtocol: 'webrtc',
    playUrl: 'webrtc://stream.example.local/a-zone/stairway-2',
    status: 'degraded',
    priority: 4,
    enabled: true,
    latency: '95ms',
    bitrate: '1.9Mbps',
    resolution: '1280x720',
    authProfile: 'webrtc-session',
  },
  {
    id: 'CAM-D02',
    name: 'D区 电梯间',
    zone: 'D区',
    protocol: 'RTSP',
    endpoint: 'rtsp://stream.example.local/d-zone/elevator',
    playProtocol: 'flv',
    playUrl: '',
    status: 'offline',
    priority: 5,
    enabled: false,
    latency: '-',
    bitrate: '0Mbps',
    resolution: '1920x1080',
    authProfile: 'edge-box-token',
  },
];

export const apiCatalog = [
  { id: 'event-ingest', group: 'backend', method: 'POST', path: '/api/security/events/ingest', name: 'AI 设备事件上报', payload: 'deviceId, eventType, confidence, frameUrl, metadata' },
  { id: 'event-query', group: 'backend', method: 'GET', path: '/api/security/events', name: '事件列表与详情', payload: 'severity, status, zone, page' },
  { id: 'stream-config', group: 'backend', method: 'GET/PUT', path: '/api/security/video-streams', name: '监控视频流配置', payload: 'streamId, protocol, endpoint, playProtocol, playUrl, enabled, authProfile' },
  { id: 'iot-command', group: 'backend', method: 'POST', path: '/api/iot/linkage/commands', name: '物联系统联动指令', payload: 'eventId, deviceType, command, priority' },
  { id: 'notification', group: 'backend', method: 'POST', path: '/api/notification/tasks', name: '人员通知与回执', payload: 'eventId, recipients, channels, escalationPolicy' },
  { id: 'agent-risk', group: 'agent', method: 'POST', path: '/agents/risk-assessor/invoke', name: '风险研判智能体', payload: 'event, sensorReadings, historicalContext' },
  { id: 'agent-vision', group: 'agent', method: 'POST', path: '/agents/vision-reviewer/invoke', name: '视觉复核智能体', payload: 'streamId, frameWindow, detectionBoxes' },
  { id: 'agent-plan', group: 'agent', method: 'POST', path: '/agents/response-planner/invoke', name: '处置方案智能体', payload: 'riskLevel, zone, availableDevices, contacts' },
  { id: 'agent-summary', group: 'agent', method: 'POST', path: '/agents/incident-summarizer/invoke', name: '事件总结智能体', payload: 'eventTimeline, linkageLogs, operatorNotes' },
];

export function getLiveStreams(streams = videoStreams) {
  return streams.filter((stream) => stream.enabled).toSorted((a, b) => a.priority - b.priority);
}

export function getEventStream(event, streams = videoStreams) {
  return streams.find((stream) => stream.id === event.cameraId) || getLiveStreams(streams)[0];
}

export function getApiGroups(catalog = apiCatalog) {
  return {
    backend: catalog.filter((api) => api.group === 'backend'),
    agent: catalog.filter((api) => api.group === 'agent'),
  };
}

export function upsertById(collection, item) {
  const index = collection.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...collection, item];
  return collection.map((entry) => (entry.id === item.id ? item : entry));
}

export function removeById(collection, id) {
  return collection.filter((entry) => entry.id !== id);
}

export function getPlatformMetrics(sourceEvents = events, streams = videoStreams, catalog = apiCatalog) {
  const allLinkage = sourceEvents.flatMap((event) => event.linkage);
  const allContacts = sourceEvents.flatMap((event) => event.contacts);
  const averageConfidence = sourceEvents.length
    ? Number((sourceEvents.reduce((sum, event) => sum + event.confidence, 0) / sourceEvents.length).toFixed(1))
    : 0;
  return {
    totalEvents: sourceEvents.length,
    criticalEvents: sourceEvents.filter((event) => event.severity === 'critical').length,
    processingEvents: sourceEvents.filter((event) => event.progress < 100).length,
    liveStreams: getLiveStreams(streams).length,
    apiReserved: catalog.length,
    activeLinkage: allLinkage.filter((item) => ['done', 'running'].includes(item.status)).length,
    totalLinkage: allLinkage.length,
    touchedContacts: allContacts.filter((item) => ['done', 'running'].includes(item.status)).length,
    totalContacts: allContacts.length,
    averageConfidence,
  };
}
