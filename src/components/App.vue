<template>
  <section>
    <h1>文字起こし</h1>

    <button @click="toggleMicrophone" :disabled="!!error" class="btn" :class="isRecording || '-active'">
      {{ isRecording ? "停止" : "開始" }}
    </button>
    <p v-if="error">Error: {{ error }}</p>

    <p>Model Status: {{ modelStatus }}</p>

    <p>{{ transcript }}</p>
  </section>
  <section>
    <h3>GPU Information in Electron</h3>
    <button class="btn" @click="getAppMetrics" id="metrics">Fetch App Metrics</button>
    <button class="btn" @click="getGPUBasicInfo" id="basic">Get Basic GPU Information</button>
    <button class="btn" @click="getGPUCompleteInfo" id="complete">Get Complete GPU Information</button>
    <button class="btn" @click="getGPUFeatureStatus" id="features">Get GPU Feature Status</button>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useMicrophone } from "../composables/useMicrophone";
import { useWhisper } from "../composables/useWhisper";
import { getAppMetrics, getGPUBasicInfo, getGPUCompleteInfo, getGPUFeatureStatus } from "../composables/getGPUStatus";

const { isRecording, error, audioData, getMicrophone, stopMicrophone } = useMicrophone();
const { modelStatus, loadModel, runInference, transcript } = useWhisper();

onMounted(() => {
  loadModel();
});

watch(audioData, (newAudioData) => {
  if (newAudioData) {
    runInference(newAudioData);
  }
});

const toggleMicrophone = () => {
  if (isRecording.value) {
    stopMicrophone();
  } else {
    getMicrophone();
  }
};
</script>
