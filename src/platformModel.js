const primaryRtspEndpoint = import.meta.env?.VITE_PRIMARY_RTSP_URL || 'rtsp://stream.example.local/a-zone/gate-main';

export const stages = ['设备上报', 'AI 复核', '风险决策', '联动执行', '复查闭环'];

export const events = [
  {
    id: 'EVT-001',
    title: '明火与烟雾',
    zone: 'A区',
    location: 'A区 · 1号楼大门入口',
    cameraId: 'CAM-A01',
    time: '10:32:45',
    severity: 'critical',
    severityText: '严重',
    confidence: 94.7,
    progress: 62,
    stage: 2,
    risk: { x: 35, y: 58, type: 'fire' },
    aiDecision: '平台 AI 判断为严重火情风险，建议立即触发声光报警、消防喷淋、疏散广播，并通知安保主管与消防负责人到场复核。',
    recommendations: ['启动 A区声光报警器', '打开疏散通道门禁', '消防喷淋进入预备状态', '通知安保主管和消防负责人'],
    detections: [
      { label: '明火特征', confidence: 94.7 },
      { label: '烟雾扩散', confidence: 82.3 },
      { label: '热源异常', confidence: 76.9 },
      { label: '误报排除', confidence: 91.4 },
    ],
    linkage: [
      { name: '声光报警器', target: 'A区 1号楼', status: 'running', label: '已触发' },
      { name: '门禁系统', target: '疏散通道', status: 'pending', label: '待解锁' },
      { name: '消防喷淋', target: '入口半径 50m', status: 'pending', label: '待联动' },
      { name: '应急广播', target: 'A区与中庭', status: 'running', label: '播报中' },
    ],
    contacts: [
      { name: '李明', role: '值班主管', channel: 'App', status: 'done', label: '已确认' },
      { name: '周倩', role: '消防负责人', channel: 'App / 短信', status: 'running', label: '待确认' },
      { name: '王磊', role: '物业经理', channel: '电话外呼', status: 'pending', label: '排队中' },
    ],
  },
  {
    id: 'EVT-002',
    title: '人员闯入',
    zone: 'B区',
    location: 'B区 · 后门通道',
    cameraId: 'CAM-B03',
    time: '10:28:12',
    severity: 'warning',
    severityText: '警告',
    confidence: 91.2,
    progress: 100,
    stage: 4,
    risk: { x: 43, y: 46, type: 'intrusion' },
    aiDecision: '系统判断为非授权人员进入后门通道，已联动门禁锁定、现场广播警告，并推送给安保巡逻人员。',
    recommendations: ['锁定 B区后门', '调取近 5 分钟回放', '通知巡逻组', '完成现场复查'],
    detections: [
      { label: '人体目标', confidence: 91.2 },
      { label: '身份未授权', confidence: 86.1 },
      { label: '热源正常', confidence: 70.2 },
      { label: '误报排除', confidence: 88.5 },
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
    title: '烟雾与热源异常',
    zone: 'C区',
    location: 'C区 · 仓库3号',
    cameraId: 'CAM-C05',
    time: '10:35:08',
    severity: 'critical',
    severityText: '严重',
    confidence: 82.1,
    progress: 25,
    stage: 1,
    risk: { x: 57, y: 35, type: 'smoke' },
    aiDecision: '烟雾与热源读数同时升高，系统建议继续复核烟感、热成像与仓库门磁，并预置消防联动方案。',
    recommendations: ['复核烟感 C-09', '读取仓库热成像', '通知仓库主管', '准备消防设备联动'],
    detections: [
      { label: '烟雾特征', confidence: 82.1 },
      { label: '热源异常', confidence: 71.5 },
      { label: '门磁状态', confidence: 63.8 },
      { label: '误报排除', confidence: 74.9 },
    ],
    linkage: [
      { name: '烟感系统', target: 'C区 C-09', status: 'running', label: '复核中' },
      { name: '消防喷淋', target: '仓库3号', status: 'pending', label: '待命' },
      { name: '仓库门禁', target: 'C区侧门', status: 'pending', label: '待检测' },
    ],
    contacts: [
      { name: '陈晨', role: '仓库主管', channel: 'App / 短信', status: 'running', label: '待确认' },
      { name: '周倩', role: '消防负责人', channel: 'App', status: 'pending', label: '待发送' },
    ],
  },
  {
    id: 'EVT-004',
    title: '消防通道堵塞',
    zone: 'A区',
    location: 'A区 · 2号楼楼梯间',
    cameraId: 'CAM-A06',
    time: '10:15:47',
    severity: 'warning',
    severityText: '警告',
    confidence: 89.3,
    progress: 40,
    stage: 2,
    risk: { x: 28, y: 73, type: 'obstruction' },
    aiDecision: '消防通道被杂物阻塞，影响疏散效率。建议通知物业清理并安排巡检机器人复查。',
    recommendations: ['创建物业清理工单', '通知楼宇管理员', '标记疏散路径风险', '巡检机器人复查'],
    detections: [
      { label: '通道堵塞', confidence: 89.3 },
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
    title: '设备离线',
    zone: 'D区',
    location: 'D区 · 电梯间',
    cameraId: 'CAM-D02',
    time: '10:20:33',
    severity: 'normal',
    severityText: '一般',
    confidence: 76.4,
    progress: 100,
    stage: 4,
    risk: { x: 71, y: 64, type: 'offline' },
    aiDecision: '监控设备短时离线后恢复。系统已通知运维团队检查网络链路，并记录设备健康状态。',
    recommendations: ['记录设备健康事件', '通知运维检查', '恢复监控流', '关闭告警'],
    detections: [
      { label: '视频流中断', confidence: 76.4 },
      { label: '网络抖动', confidence: 69.2 },
      { label: '设备恢复', confidence: 93 },
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
    playUrl: '',
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
    averageConfidence: Number((sourceEvents.reduce((sum, event) => sum + event.confidence, 0) / sourceEvents.length).toFixed(1)),
  };
}
