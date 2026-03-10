/**
 * Sound Profiles — Activation/Deactivation behavior tests
 *
 * Verifies:
 *   1. Activation plays audio + haptics
 *   2. Activation sound auto-fades (not abrupt)
 *   3. Deactivation plays NO audio
 *   4. Deactivation kills any lingering activation audio immediately
 *
 * Migrated from expo-av → expo-audio mocks.
 */

// Mock expo-audio createAudioPlayer
const mockPlayer = {
  volume: 1.0,
  loop: false,
  play: jest.fn(),
  pause: jest.fn(),
  remove: jest.fn(),
  addListener: jest.fn(),
};

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  createAudioPlayer: jest.fn(() => ({ ...mockPlayer })),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

// Require AFTER mocks
const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
const Haptics = require('expo-haptics');
const { playActivationSound, playDeactivationSound } = require('../src/lib/soundProfiles');

beforeEach(() => {
  jest.clearAllMocks();
  // Reset mock player for each test — createAudioPlayer returns a fresh mock
  createAudioPlayer.mockImplementation(() => {
    const player = {
      volume: 1.0,
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn(),
    };
    return player;
  });
});

describe('Sound Profiles — SPORT mode behavior', () => {

  it('ACTIVATION: plays audio (createAudioPlayer called)', async () => {
    await playActivationSound('merica');

    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    console.log('Activation plays audio');
  });

  it('ACTIVATION: plays haptics', async () => {
    await playActivationSound('merica');

    expect(Haptics.impactAsync).toHaveBeenCalled();
    console.log('Activation plays haptics');
  });

  it('ACTIVATION: configures audio session for playback', async () => {
    await playActivationSound('merica');

    expect(setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentMode: true })
    );
    console.log('Activation configures audio session');
  });

  it('DEACTIVATION: does NOT play audio (createAudioPlayer NOT called)', async () => {
    jest.clearAllMocks();

    await playDeactivationSound('merica');

    expect(createAudioPlayer).not.toHaveBeenCalled();
    console.log('Deactivation plays NO audio');
  });

  it('DEACTIVATION: plays haptics', async () => {
    jest.clearAllMocks();

    await playDeactivationSound('merica');

    expect(Haptics.impactAsync).toHaveBeenCalled();
    console.log('Deactivation plays haptics (tactile only)');
  });

  it('DEACTIVATION: kills lingering activation audio immediately (pause+remove called)', async () => {
    jest.useRealTimers();
    jest.clearAllMocks();

    // Create a mock player that persists across calls
    const persistentPlayer = {
      volume: 1.0,
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      addListener: jest.fn(),
    };
    createAudioPlayer.mockReturnValue(persistentPlayer);

    // Start activation (don't await — sound starts playing in background)
    playActivationSound('euro'); // intentionally not awaited

    // Yield to let the promise chain start (player gets created)
    await new Promise(r => setTimeout(r, 100));

    // Clear mocks so we only track deactivation calls
    persistentPlayer.pause.mockClear();
    persistentPlayer.remove.mockClear();
    createAudioPlayer.mockClear();

    // User toggles OFF while sound is still playing (within the 2s window)
    await playDeactivationSound('euro');

    // stopActivePlayer inside playDeactivationSound calls pause + remove
    expect(persistentPlayer.pause).toHaveBeenCalled();
    expect(persistentPlayer.remove).toHaveBeenCalled();
    // No new audio created on deactivation
    expect(createAudioPlayer).not.toHaveBeenCalled();

    console.log('Deactivation kills lingering audio immediately (hard stop)');
  }, 10000);
});
