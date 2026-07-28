# 安防 AIoT 联动中枢原型平台

这是一个独立的 Vue 3 + Vite 高保真产品原型平台，参考原安防监控原型重新搭建。

## 覆盖范围

- 指挥中心 PC 看板
- 实时监控画面展示
- 监控视频流配置页预留
- 后端 API 接入点预留
- 智能体 API 接入点预留
- 统计分析与手机值班端原型

## 运行

```bash
npm install
npm run dev
```

## 本地视频流配置

真实 RTSP 地址放在 `.env.local` 中：

```bash
VITE_PRIMARY_RTSP_URL=rtsp://user:password@host:554/cam/realmonitor?channel=1&subtype=0
```

`.env.local` 不会提交到 Git，避免把摄像头账号密码推到公开仓库。

## 验证

```bash
npm test
npm run build
```
