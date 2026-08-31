# 安防 AIoT 联动中枢原型平台

这是一个独立的 Vue 3 + Vite 高保真产品原型平台，参考原安防监控原型重新搭建。

## 覆盖范围

- 指挥中心 PC 看板
- 实时监控画面展示
- 监控视频流配置页预留
- 后端 API 接入点预留
- 智能体 API 接入点预留
- 接口模拟中心：请求 JSON、响应 JSON、字段说明、状态码和调用链路
- 统计分析与手机值班端原型

## 运行

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动：

- Vue 前端：`http://127.0.0.1:5176/` 或 Vite 自动分配端口
- 本地转流服务：`http://127.0.0.1:5177/`

## 本地视频流配置

真实 RTSP 地址放在 `.env.local` 中：

```bash
VITE_PRIMARY_RTSP_URL=rtsp://user:password@host:554/cam/realmonitor?channel=1&subtype=0
VITE_PRIMARY_PLAY_URL=http://127.0.0.1:5177/hls/cam-a01/index.m3u8
STREAM_SERVER_PORT=5177
STREAM_ID=cam-a01
```

`.env.local` 不会提交到 Git，避免把摄像头账号密码推到公开仓库。

本地转流服务会用项目内置 ffmpeg 将 RTSP 转成 HLS，前端通过 `hls.js` 播放 `VITE_PRIMARY_PLAY_URL`。

## 验证

```bash
npm test
npm run build
```

## 接口交付

接口页读取 `public/api/api-mocks.json`，这份文件就是当前前端使用到的完整接口契约。后端实现时可以优先参考：

- `public/api/api-mocks.json`：完整接口模拟契约
- `public/api/api-catalog.json`：配置页使用的接口简表
- `docs/api-contract.md`：字段说明和联调约定

## 产品文档

- `docs/product-document.md`：面向讲解和汇报的产品说明文档，说明系统解决什么问题、怎么使用、怎么演示
