# API JSON 契约

当前前端默认读取 `public/api` 下的本地 JSON 文件。后端接入时，只要把这些路径替换成真实接口，并保持字段结构一致，页面就能直接切换到后端数据。

## 前端接口页

新增的「接口」页面读取：

- `GET /api/api-mocks.json`

这份文件是完整接口模拟契约，包含：

- 接口分组：`backend | agent`
- 接口领域：`dashboard | video | event | agent | iot | notification | audit | governance`
- 页面使用位置：`usedBy`
- 请求示例：`requestExample`
- 响应示例：`responseExample`
- 字段说明：`fields`
- 状态码：`statusCodes`
- 业务调用链：`flows`

后端可以优先按 `public/api/api-mocks.json` 实现接口；如果字段需要调整，前端页面和这份 JSON 应同步修改。

## Mock 文件清单

| 文件 | 用途 | 页面 |
| --- | --- | --- |
| `public/api/dashboard.json` | 指挥看板、统计分析、事件队列、AI 决策、联动和通知 | 指挥 / 分析 |
| `public/api/video-streams.json` | 摄像头接入、播放协议、HLS/FLV/WebRTC 播放地址、快照 | 指挥 / 配置 |
| `public/api/api-catalog.json` | 接口简表，供配置页展示与编辑 | 配置 |
| `public/api/api-mocks.json` | 完整接口契约，供后端实现和产品评审 | 接口 |

## 当前接口族

| ID | Method | Path | 说明 |
| --- | --- | --- | --- |
| `dashboard-overview` | GET | `/api/dashboard.json` | 指挥看板汇总 |
| `video-streams` | GET | `/api/video-streams.json` | 视频流配置 |
| `event-ingest` | POST | `/api/security/events/ingest` | AI 设备事件上报 |
| `event-detail` | GET | `/api/security/events/{eventId}` | 事件详情 |
| `iot-command` | POST | `/api/iot/linkage/commands` | 物联系统联动指令 |
| `notification-task` | POST | `/api/notification/tasks` | 人员通知任务 |
| `notification-receipts` | GET | `/api/notification/tasks/{taskId}/receipts` | 通知回执查询 |
| `contacts` | GET | `/api/security/contacts` | 应急联系人 |
| `audit-logs` | POST | `/api/security/audit-logs` | 处置审计日志 |
| `api-catalog` | GET | `/api/api-catalog.json` | 接口目录 |
| `agent-vision` | POST | `/agents/vision-reviewer/invoke` | 视觉复核智能体 |
| `agent-risk` | POST | `/agents/risk-assessor/invoke` | 风险研判智能体 |
| `agent-plan` | POST | `/agents/response-planner/invoke` | 处置方案智能体 |

## GET /api/dashboard.json

用于指挥看板、统计分析、事件队列、AI 决策、物联系统联动和人员通知。

关键字段：

- `operator`: 当前值班人员。
- `stages`: 处置阶段名称数组。
- `incidents`: 事件列表。
- `incidents[].severity`: `critical | warning | normal`。
- `incidents[].stage`: 对应 `stages` 数组下标，从 0 开始。
- `incidents[].detections`: 识别信号。
- `incidents[].linkage`: 物联动作列表。
- `incidents[].contacts`: 通知对象和回执。

## GET /api/video-streams.json

用于监控视频源配置。`endpoint` 是原始流地址，`playUrl` 是浏览器实际播放地址。浏览器不能直接播放 RTSP，通常需要后端或本地服务转换成 HLS、FLV、MPEG-TS 或 WebRTC。

关键字段：

- `streams[].protocol`: 原始接入协议，建议值 `RTSP | HLS | WebRTC | FLV`。
- `streams[].endpoint`: 原始流，可返回脱敏值或配置引用。
- `streams[].playProtocol`: 前端播放器协议，建议值 `hls | flv | mpegts | webrtc | native`。
- `streams[].playUrl`: 浏览器可播放地址。
- `streams[].snapshotUrl`: 可选，用于播放握手前显示快照。
- `streams[].authProfile`: 认证配置引用，不建议返回明文密码。

## GET /api/api-catalog.json

用于配置页展示后端 API 和智能体 API 的接入清单。它是 `api-mocks.json` 的轻量索引，必须覆盖同一批接口 ID。

关键字段：

- `apis[].id`: 接口唯一 ID。
- `apis[].group`: `backend | agent`。
- `apis[].method`: HTTP 方法。
- `apis[].path`: 接口路径。
- `apis[].payload`: 字段模板。

## GET /api/api-mocks.json

用于接口页展示完整契约。

关键字段：

- `summary.total`: `interfaces.length`。
- `summary.backend`: `group === "backend"` 的接口数量。
- `summary.agent`: `group === "agent"` 的接口数量。
- `interfaces[].usedBy`: 哪些页面或流程使用该接口。
- `interfaces[].requestExample`: 请求 JSON 示例。
- `interfaces[].responseExample`: 响应 JSON 示例。
- `interfaces[].fields`: 字段说明。
- `interfaces[].statusCodes`: 状态码说明。
- `flows[]`: 业务调用链说明。

## 本地联调约定

- 前端开发地址：`http://127.0.0.1:5176/`
- 本地转流服务：`http://127.0.0.1:5177/`
- HLS 地址：`http://127.0.0.1:5177/hls/cam-a01/index.m3u8`
- 快照地址：`http://127.0.0.1:5177/snapshot/cam-a01.jpg`
- 转流状态：`http://127.0.0.1:5177/api/streams/status`

真实 RTSP 地址放在 `.env.local` 中，该文件已被 `.gitignore` 排除，不应提交到公开仓库。
