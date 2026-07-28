<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

const props = defineProps({
  stream: {
    type: Object,
    required: true,
  },
});

const videoRef = ref(null);
const playerStatus = ref('waiting');
const playerMessage = ref('');
const hlsInstance = shallowRef(null);
const mpegtsInstance = shallowRef(null);
const snapshotTick = ref(Date.now());

const playProtocol = computed(() => (props.stream.playProtocol || props.stream.protocol || '').toLowerCase());
const playUrl = computed(() => props.stream.playUrl || '');
const canPlay = computed(() => Boolean(playUrl.value));
const displayUrl = computed(() => (props.stream.playUrl || props.stream.endpoint || '').replace(/:\/\/([^:@/\s]+):([^@/\s]+)@/u, '://$1:******@'));
const snapshotUrl = computed(() => (props.stream.snapshotUrl ? `${props.stream.snapshotUrl}?t=${snapshotTick.value}` : ''));

let readyTimer = null;
let snapshotTimer = null;

function clearTimers() {
  if (readyTimer) {
    clearTimeout(readyTimer);
    readyTimer = null;
  }
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
}

function destroyPlayers() {
  clearTimers();

  if (hlsInstance.value) {
    hlsInstance.value.destroy();
    hlsInstance.value = null;
  }

  if (mpegtsInstance.value) {
    mpegtsInstance.value.destroy();
    mpegtsInstance.value = null;
  }

  if (videoRef.value) {
    videoRef.value.removeAttribute('src');
    videoRef.value.load();
  }
}

function markReady(message = '播放源已加载') {
  playerStatus.value = 'ready';
  playerMessage.value = message;
  if (videoRef.value) videoRef.value.play().catch(() => {});
}

function markVideoFrameReady() {
  if (videoRef.value?.readyState >= 2) markReady('视频画面已加载');
}

function startSnapshotRefresh() {
  if (!props.stream.snapshotUrl || snapshotTimer) return;
  snapshotTimer = setInterval(() => {
    snapshotTick.value = Date.now();
  }, 3000);
}

async function setupPlayer() {
  destroyPlayers();
  startSnapshotRefresh();

  if (!canPlay.value) {
    playerStatus.value = 'waiting';
    playerMessage.value = '已写入 RTSP 原始流，等待配置转流后的 WebRTC / HLS / FLV 播放地址。';
    return;
  }

  if (!videoRef.value) return;

  playerStatus.value = 'connecting';
  playerMessage.value = '正在连接视频播放源';

  try {
    if (playProtocol.value === 'hls') {
      if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.value.src = playUrl.value;
      } else {
        const Hls = (await import('hls.js')).default;
        if (!Hls.isSupported()) throw new Error('当前浏览器不支持 HLS MediaSource 播放');
        hlsInstance.value = new Hls({ lowLatencyMode: true });
        hlsInstance.value.on(Hls.Events.MANIFEST_PARSED, () => {
          playerMessage.value = 'HLS 清单已加载，等待视频帧';
        });
        hlsInstance.value.on(Hls.Events.ERROR, (_, data) => {
          if (data?.fatal) {
            playerStatus.value = 'error';
            playerMessage.value = data.details || 'HLS 播放失败';
          }
        });
        hlsInstance.value.loadSource(playUrl.value);
        hlsInstance.value.attachMedia(videoRef.value);
      }
    } else if (['flv', 'mpegts', 'mse'].includes(playProtocol.value)) {
      const mpegts = await import('mpegts.js');
      if (!mpegts.default.isSupported()) throw new Error('当前浏览器不支持 MPEG-TS/FLV MediaSource 播放');
      mpegtsInstance.value = mpegts.default.createPlayer({
        type: playProtocol.value === 'flv' ? 'flv' : 'mpegts',
        isLive: true,
        url: playUrl.value,
      });
      mpegtsInstance.value.attachMediaElement(videoRef.value);
      mpegtsInstance.value.load();
      readyTimer = setTimeout(() => markReady('MPEG-TS/FLV 播放源已加载'), 1000);
    } else if (playProtocol.value === 'webrtc') {
      playerStatus.value = 'waiting';
      playerMessage.value = 'WebRTC 需要信令或 WHEP 拉流实现，当前已保留播放地址配置。';
      return;
    } else {
      videoRef.value.src = playUrl.value;
      readyTimer = setTimeout(() => markReady('播放源已加载'), 500);
    }

    if (playProtocol.value === 'hls') {
      readyTimer = setTimeout(() => {
        if (playerStatus.value === 'connecting' && !props.stream.snapshotUrl) markReady('HLS 播放源已连接');
      }, 2000);
    }
  } catch (error) {
    playerStatus.value = 'error';
    playerMessage.value = error instanceof Error ? error.message : '播放器初始化失败';
  }
}

watch(() => [props.stream.id, props.stream.playUrl, props.stream.playProtocol, props.stream.snapshotUrl], setupPlayer, {
  immediate: true,
});

onMounted(setupPlayer);
onBeforeUnmount(destroyPlayers);
</script>

<template>
  <div
    class="stream-player"
    :class="playerStatus"
    :style="snapshotUrl ? { backgroundImage: `url(${snapshotUrl})` } : {}"
  >
    <img v-if="snapshotUrl" class="stream-snapshot" :src="snapshotUrl" alt="实时视频快照">
    <video ref="videoRef" muted autoplay playsinline controls @loadeddata="markVideoFrameReady" @playing="markVideoFrameReady"></video>
    <div v-if="playerStatus !== 'ready' && !snapshotUrl" class="player-overlay">
      <b>{{ playerStatus === 'error' ? '播放异常' : '等待播放源' }}</b>
      <span>{{ playerMessage }}</span>
      <code>{{ displayUrl }}</code>
    </div>
  </div>
</template>
