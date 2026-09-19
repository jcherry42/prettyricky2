/**
 * asFormDataFile — SDK 57-safe FormData file part.
 *
 * Expo SDK 57's global fetch (expo/fetch, WinterCG) rejects React Native's
 * classic `{ uri, name, type }` FormData parts with
 * "Unsupported FormDataPart implementation". Its converter accepts any entry
 * exposing `name`, `type` and a `bytes()` method — which expo-file-system's
 * File provides. This wrapper keeps explicit filename/mime control.
 */
import { File as FSFile } from 'expo-file-system';

export function asFormDataFile(uri: string, name: string, type: string): Blob {
  const file = new FSFile(uri);
  const part = {
    name,
    type,
    bytes: () => file.bytes(),
  };
  return part as unknown as Blob;
}
