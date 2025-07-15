<template>
  <section>
    <h1>文字起こし</h1>

    <button @click="toggleMicrophone" :disabled="!!error" class="btn" :class="isRecording || '-active'">
      {{ isRecording ? "停止" : "開始" }}
    </button>
    <p v-if="error">Error: {{ error }}</p>

    <p>Model Status: {{ modelStatus }}</p>

    <p>{{ _text }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useMicrophone } from "../composables/useMicrophone";
import { useWhisper } from "../composables/useWhisper";

let _text = ref<string>("ここにテキストが表示されます");

const { isRecording, error, getMicrophone, stopMicrophone } = useMicrophone();
const { modelStatus, loadModel } = useWhisper();

onMounted(() => {
  // main.tsでpreload.tsを介してモデルのパスを受け取る想定
  window.electron.getModelPath().then((modelPath: string) => {
    loadModel(modelPath);
  });
});

const toggleMicrophone = () => {
  if (isRecording.value) {
    stopMicrophone();
  } else {
    getMicrophone();
  }
};
</script>
