/**
 * Sound Profiles — Activation/Deactivation behavior tests
 *
 * Verifies:
 *   1. Activation plays audio + haptics
 *   2. Activation sound auto-fades (not abrupt)
 *   3. Deactivation plays NO audio
 *   4. Deactivation kills any lingering activation audio immediately
 */

// Mock expo-av Audio module
const mockSetVolumeAsync = jest.fn().mockResolvedValue(undefined);
const mockStopAsync = jest.fn().mockResolvedValue(undefined);
const mockUnloadAsync = jest.fn().mockResolvedValue(undefined);
const mockSetOnPlaybackStatusUpdate = jest.fn();

const mockSoundInstance = {
  setVolumeAsync: mockSetVolumeAsync,
  stopAsync: mockStopAsync,
  unloadAsync: mockUnloadAsync,
  setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
};

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({ sound: mockSoundInstance }),
    },
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

// Require AFTER mocks
const { Audio } = require('expo-av');
const Haptics = require('expo-haptics');
const { playActivationSound, playDeactivationSound } = require('../src/lib/soundProfiles');

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the internal _activeSound by ensuring mock is clean
  Audio.Sound.createAsync.mockResolvedValue({ sound: mockSoundInstance });
});

describe('Sound Profiles — SPORT mode behavior', () => {

  it('ACTIVATION: plays audio (Audio.Sound.createAsync called)', async () => {
    await playActivationSound('merica');

    expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1);
    console.log('✅ Activation plays audio');
  });

  it('ACTIVATION: plays haptics', async () => {
    await playActivationSound('merica');

    expect(Haptics.impactAsync).toHaveBeenCalled();
    console.log('✅ Activation plays haptics');
  });

  it('ACTIVATION: auto-fades (setVolumeAsync called with decreasing values)', async () => {
    // Use real timers for this test since fade uses delay()
    jest.useRealTimers();

    await playActivationSound('merica');

    // setVolumeAsync should have been called multiple times with decreasing values
    // (fade runs after 2s delay, 30 steps over 1.5s)
    expect(mockSetVolumeAsync).toHaveBeenCalled();

    const volumeCalls = mockSetVolumeAsync.mock.calls.map(c => c[0]);
    // Volumes should be decreasing
    for (let i = 1; i < volumeCalls.length; i++) {
      expect(volumeCalls[i]).toBeLessThanOrEqual(volumeCalls[i - 1]);
    }
    // Last volume should be 0
    expect(volumeCalls[volumeCalls.length - 1]).toBe(0);

    console.log(`✅ Activation auto-fades: ${volumeCalls.length} volume steps, last = ${volumeCalls[volumeCalls.length - 1]}`);
  }, 15000);

  it('DEACTIVATION: does NOT play audio (Audio.Sound.createAsync NOT called)', async () => {
    jest.clearAllMocks();

    await playDeactivationSound('merica');

    expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
    console.log('✅ Deactivation plays NO audio');
  });

  it('DEACTIVATION: plays haptics', async () => {
    jest.clearAllMocks();

    await playDeactivationSound('merica');

    expect(Haptics.impactAsync).toHaveBeenCalled();
    console.log('✅ Deactivation plays haptics (tactile only)');
  });

  it('DEACTIVATION: kills lingering activation audio immediately (stopAsync called)', async () => {
    jest.useRealTimers();
    jest.clearAllMocks();

    // Start activation (don't await — sound starts playing in background)
    playActivationSound('euro'); // intentionally not awaited

    // Yield to let the promise chain start (sound gets created)
    await new Promise(r => setTimeout(r, 100));

    // Clear mocks so we only track deactivation calls
    mockStopAsync.mockClear();
    mockUnloadAsync.mockClear();
    Audio.Sound.createAsync.mockClear();

    // User toggles OFF while sound is still playing (within the 2s window)
    await playDeactivationSound('euro');

    // stopActiveSound inside playDeactivationSound calls stopAsync
    expect(mockStopAsync).toHaveBeenCalled();
    // No new audio created on deactivation
    expect(Audio.Sound.createAsync).not.toHaveBeenCalled();

    console.log('✅ Deactivation kills lingering audio immediately (hard stop)');
  }, 10000);
});
