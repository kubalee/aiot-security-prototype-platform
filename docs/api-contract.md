# API JSON 契约

当前前端默认读取 `public/api` 下的本地 JSON 文件。后端接入时，只要把这些路径替换成真实接口，并保持字段结构一致，页面就能直接切换到后端数据。

## GET /api/dashboard.json

用于指挥看板、统计分析、事件队列、AI 决策、物联系统联动和人员通知。

```json
{
  "operator": {
    "name": "李明",
    "role": "值班主管",
    "time": "14:42:26"
  },
  "stages": ["设备上报", "AI 复核", "风险决策", "联动执行", "复查闭环"],
  "incidents": [
    {
      "id": "INC-20260728-001",
      "title": "A区入口摄像头在线",
      "zone": "A区",
      "location": "A区 · 1号楼大门入口",
      "cameraId": "CAM-A01",
      "time": "14:40:18",
      "severity": "normal",
      "severityText": "在线",
      "confidence": 97.4,
      "progress": 100,
      "stage": 4,
      "aiDecision": "当前已接入实时监控视频流。AI 识别、告警复核、物联系统联动结果将等待后端事件接口推送后更新。",
      "recommendations": ["保持视频流在线", "等待 AI 事件接口上报"],
      "detections": [{ "label": "实时视频流", "confidence": 100 }],
      "linkage": [{ "name": "视频网关", "target": "CAM-A01", "status": "done", "label": "已接入" }],
      "contacts": [{ "name": "李明", "role": "值班主管", "channel": "App", "status": "pending", "label": "待通知" }]
    }
  ]
}
```

字段说明：
- `severity`: `critical | warning | normal`，用于等级统计和状态样式。
- `stage`: 对应 `stages` 数组下标，从 0 开始。
- `progress`: 0 到 100，用于处理中/闭环判断。
- `linkage.status` / `contacts.status`: `pending | running | done`。

## GET /api/video-streams.json

用于监控视频源配置。`endpoint` 是原始流地址，`playUrl` 是浏览器实际播放地址。浏览器不能直接播放 RTSP，通常需要后端或本地服务转换成 HLS、FLV、MPEG-TS 或 WebRTC。

```json
{
  "streams": [
    {
      "id": "CAM-A01",
      "name": "A区 1号楼大门入口",
      "zone": "A区",
      "protocol": "RTSP",
      "endpoint": "rtsp://user:password@host:554/cam/realmonitor?channel=1&subtype=0",
      "playProtocol": "hls",
      "playUrl": "http://127.0.0.1:5177/hls/cam-a01/index.m3u8",
      "snapshotUrl": "http://127.0.0.1:5177/snapshot/cam-a01.jpg",
      "status": "online",
      "priority": 1,
      "enabled": true,
      "latency": "实时",
      "bitrate": "自适应",
      "resolution": "1920x1080",
      "authProfile": "local-env"
    }
  ]
}
```

字段说明：
- `protocol`: 原始接入协议，建议值 `RTSP | HLS | WebRTC | FLV`。
- `playProtocol`: 前端播放器协议，建议值 `hls | flv | mpegts | webrtc | native`。
- `endpoint`: 可包含凭据，但生产环境建议后端只返回脱敏值或配置引用。
- `snapshotUrl`: 可选；用于在 HLS/WebRTC 播放握手前显示实时快照。

## GET /api/api-catalog.json

用于页面展示后端 API 和智能体 API 的接入清单。

```json
{
  "apis": [
    {
      "id": "event-ingest",
      "group": "backend",
      "method": "POST",
      "path": "/api/security/events/ingest",
      "name": "AI 设备事件上报",
      "payload": {
        "deviceId": "string",
        "cameraId": "string",
        "eventType": "string",
        "confidence": "number",
        "frameUrl": "string",
        "metadata": "object"
      }
    },
    {
      "id": "agent-risk",
      "group": "agent",
      "method": "POST",
      "path": "/agents/risk-assessor/invoke",
      "name": "风险研判智能体",
      "payload": {
        "event": "object",
        "sensorReadings": "array",
        "historicalContext": "object"
      }
    }
  ]
}
```

字段说明：
- `group`: `backend | agent`。
- `payload`: 可用字符串、对象或字段模板；前端会统一转成文本展示。

## 本地联调约定

- 前端开发地址：`http://127.0.0.1:5176/`
- 本地转流服务：`http://127.0.0.1:5177/`
- HLS 地址：`http://127.0.0.1:5177/hls/cam-a01/index.m3u8`
- 快照地址：`http://127.0.0.1:5177/snapshot/cam-a01.jpg`
- 转流状态：`http://127.0.0.1:5177/api/streams/status`

真实 RTSP 地址放在 `.env.local` 中，该文件已被 `.gitignore` 排除，不应提交到公开仓库。
