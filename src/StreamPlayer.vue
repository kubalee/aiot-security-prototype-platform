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

const playProtocol = computed(() => (props.stream.playProtocol || props.stream.protocol || '').toLowerCase());
const playUrl = computed(() => props.stream.playUrl || '');
const canPlay = computed(() => Boolean(playUrl.value));
const displayUrl = computed(() => (props.stream.playUrl || props.stream.endpoint || '').replace(/:\/\/([^:@/\s]+):([^@/\s]+)@/u, '://$1:******@'));

function destroyPlayers() {
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

async function setupPlayer() {
  destroyPlayers();

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
    } else if (playProtocol.value === 'webrtc') {
      playerStatus.value = 'waiting';
      playerMessage.value = 'WebRTC 需要信令或 WHEP 拉流实现，当前已保留播放地址配置。';
      return;
    } else {
      videoRef.value.src = playUrl.value;
    }

    await videoRef.value.play().catch(() => {});
    playerStatus.value = 'ready';
    playerMessage.value = '播放源已加载';
  } catch (error) {
    playerStatus.value = 'error';
    playerMessage.value = error instanceof Error ? error.message : '播放器初始化失败';
  }
}

watch(() => [props.stream.id, props.stream.playUrl, props.stream.playProtocol], setupPlayer, {
  immediate: true,
});

onMounted(setupPlayer);
onBeforeUnmount(destroyPlayers);
</script>

<template>
  <div class="stream-player" :class="playerStatus">
    <video ref="videoRef" muted autoplay playsinline controls></video>
    <div v-if="playerStatus !== 'ready'" class="player-overlay">
      <b>{{ playerStatus === 'error' ? '播放异常' : '等待播放源' }}</b>
      <span>{{ playerMessage }}</span>
      <code>{{ displayUrl }}</code>
    </div>
  </div>
</template>
