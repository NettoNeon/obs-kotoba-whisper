
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMicrophone } from "./useMicrophone";

describe("useMicrophone", () => {
  const mockMediaStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;

  beforeEach(() => {
    global.navigator.mediaDevices = {
      ...global.navigator.mediaDevices,
      getUserMedia: vi.fn(),
    };
  });

  it("should request and receive microphone stream", async () => {
    const { getMicrophone, stream, isRecording, error } = useMicrophone();
    (navigator.mediaDevices.getUserMedia as vi.Mock).mockResolvedValue(mockMediaStream);

    await getMicrophone();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stream.value).toEqual(mockMediaStream);
    expect(isRecording.value).toBe(true);
    expect(error.value).toBeNull();
  });

  it("should handle microphone access error", async () => {
    const { getMicrophone, stream, isRecording, error } = useMicrophone();
    const errorMessage = "Permission denied";
    (navigator.mediaDevices.getUserMedia as vi.Mock).mockRejectedValue(new Error(errorMessage));

    await getMicrophone();

    expect(stream.value).toBeNull();
    expect(isRecording.value).toBe(false);
    expect(error.value).toBe(errorMessage);
  });

  it("should stop the microphone stream", async () => {
    const { getMicrophone, stopMicrophone, stream, isRecording } = useMicrophone();
    (navigator.mediaDevices.getUserMedia as vi.Mock).mockResolvedValue(mockMediaStream);

    await getMicrophone();
    stopMicrophone();

    expect(stream.value).toBeNull();
    expect(isRecording.value).toBe(false);
    expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
  });
});
