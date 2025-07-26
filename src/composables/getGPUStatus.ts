export async function getAppMetrics() {
  try {
    const metrics = await window.electron.getAppMetrics();
    console.log("App Metrics:", metrics);
    // ここでUIに結果を表示することも可能
  } catch (error) {
    console.error("Failed to get App Metrics:", error);
  }
}

export async function getGPUBasicInfo() {
  try {
    const basicInfo = await window.electron.getGPUBasicInfo();
    console.log("GPU Basic Info:", basicInfo);
  } catch (error) {
    console.error("Failed to get GPU Basic Info:", error);
  }
}
export async function getGPUCompleteInfo() {
  try {
    const completeInfo = await window.electron.getGPUCompleteInfo();
    console.log("GPU Complete Info:", completeInfo);
  } catch (error) {
    console.error("Failed to get GPU Complete Info:", error);
  }
}
export async function getGPUFeatureStatus() {
  try {
    const featureStatus = await window.electron.getGPUFeatureStatus();
    console.log("GPU Feature Status:", featureStatus);
  } catch (error) {
    console.error("Failed to get GPU Feature Status:", error);
  }
}
