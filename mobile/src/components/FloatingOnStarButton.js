import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// OnStar-inspired Tower Talk button: glowing red.
export function FloatingOnStarButton({ onPress }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.985 }], opacity: 0.94 }]}>
        <LinearGradient
          colors={['rgba(255,45,45,0.55)', 'rgba(120,0,0,0.25)', 'rgba(0,0,0,0.25)']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 1.0, y: 1.0 }}
        />
        <Text style={styles.star}>✶</Text>
        <Text style={styles.label}>ONSTAR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    bottom: 86,
  },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,45,45,0.55)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255,45,45,0.55)',
    shadowOpacity: 0.75,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    backgroundColor: 'rgba(255,45,45,0.08)',
  },
  star: {
    color: 'rgba(255,245,245,0.95)',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  label: {
    color: 'rgba(255,245,245,0.95)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
});
