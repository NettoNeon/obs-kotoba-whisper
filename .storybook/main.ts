import type { StorybookConfig } from "@storybook/vue3-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx|vue)"],
  addons: ["@chromatic-com/storybook", "@storybook/addon-docs", "@storybook/addon-onboarding", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/vue3-vite",
    options: {},
  },
  viteFinal: async (config, { configType }) => {
    config.plugins = config.plugins || [];
    config.plugins.push(require("@vitejs/plugin-vue").default());

    // 以下の設定は、もしVue3 Composition APIのSetup Scriptを使用している場合に必要になることがあります
    // config.optimizeDeps = config.optimizeDeps || {};
    // config.optimizeDeps.include = config.optimizeDeps.include || [];
    // config.optimizeDeps.include.push('vue');

    return config;
  },
};
export default config;
