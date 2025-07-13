<template>
  <section>
    <h1>文字起こし</h1>
    <button ref="btnRec" class="btn" :class="_rec || '-active'">
      <span v-if="!_rec">開始</span>
      <span v-else>停止</span>
    </button>

    <p>{{ _text }}</p>
  </section>
</template>

<script setup lang="ts">
import { useTemplateRef, ref, onMounted } from "vue";
let _text = ref<string>("ここにテキストが表示されます");
let _rec = ref<boolean>(false);
const BtnRec = useTemplateRef("btnRec");

function startRec() {}

function stopRec() {}

onMounted(() => {
  BtnRec.value?.addEventListener("click", () => {
    _rec.value = !_rec.value;
  });
});

// すべての編集はここから先に記述する
</script>
