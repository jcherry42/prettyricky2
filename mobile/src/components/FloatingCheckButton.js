import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';

// CHECK ENGINE button: short press opens Command Center; long press opens Print Center.


export function FloatingCheckButton({ onPress, onLongPress }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={380}
        style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.985 }], opacity: 0.94 }]}
      >
        <LinearGradient
          colors={['rgba(214,178,94,0.92)', 'rgba(214,178,94,0.30)', 'rgba(0,0,0,0.20)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 1.0, y: 1.0 }}
        />
        <Text style={styles.icon}>⛭</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    bottom: 86,
  },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.50)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    backgroundColor: 'rgba(214,178,94,0.12)',
  },
  icon: {
    color: '#0E0E0E',
    fontSize: 22,
    fontWeight: '900',
  },
});
