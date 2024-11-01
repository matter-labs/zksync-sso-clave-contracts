<template>
  <ZkTooltip :label="copyLabel">
    <ZkButtonIcon
      icon="open_in_new"
      :ui="{ button: { base: 'py-0' } }"
      @click="copyContent"
    />
  </ZkTooltip>
</template>

<script setup lang="ts">
const props = defineProps({
  content: {
    type: String,
    required: true,
  },
});

const { copy } = useClipboard({
  source: props.content,
});

const copyLabel = ref("Copy");

function copyContent() {
  copy(props.content);
  copyLabel.value = "Copied!";
  setTimeout(() => {
    copyLabel.value = "Copy";
  }, 2500);
}
</script>
