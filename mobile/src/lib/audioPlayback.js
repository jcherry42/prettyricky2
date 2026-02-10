import { Audio } from 'expo-av';

export async function playBase64Audio({ base64, format = 'mp3' }) {
  if (!base64) throw new Error('Empty audio');

  const mime = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
  const uri = `data:${mime};base64,${base64}`;

  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

  const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
  return sound;
}
