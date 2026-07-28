# API JSON 契约

当前前端默认读取 `public/api` 下的本地 JSON 文件。后端接入时，只要把这些路径替换成真实接口，并保持字段结构一致，页面就能直接切换到后端数据。

## GET /api/dashboard.json

用于指挥看板、统计分析、事件队列、AI 决策、联动和人员通知。

```json
{
  "operator": {
    "name": "李明",
    "role": "值班主管",
    "time": "10:37:26"
  },
  "stages": ["设备上报", "AI 复核", "风险决策", "联动执行", "复查闭环"],
  "incidents": [
    {
      "id": "INC-20260728-001",
      "title": "A区入口摄像头在线",
      "zone": "A区",
      "location": "A区 · 1号楼大门入口",
      "cameraId": "CAM-A01",
      "time": "10:32:45",
      "severity": "normal",
      "severityText": "在线",
      "confidence": 0,
      "progress": 0,
      "stage": 0,
      "aiDecision": "AI 决策说明",
      "recommendations": ["处置建议"],
      "detections": [{ "label": "识别项", "confidence": 100 }],
      "linkage": [{ "name": "设备", "target": "点位", "status": "pending", "label": "待接口" }],
      "contacts": [{ "name": "人员", "role": "角色", "channel": "App", "status": "pending", "label": "待通知" }]
    }
  ]
}
```

## GET /api/video-streams.json

用于监控视频源配置。`endpoint` 是原始流地址，`playUrl` 是浏览器实际播放地址。

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
    }
  ]
}
```
