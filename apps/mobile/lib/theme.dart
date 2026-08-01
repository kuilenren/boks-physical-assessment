import 'package:flutter/material.dart';

const boksBrand = Color(0xFF2E8B57);
const boksBrandLight = Color(0xFFE9F7E7);
const boksCanvas = Color(0xFFF7FBF6);
const boksInk = Color(0xFF173329);
const boksMuted = Color(0xFF4C6258);
const boksBorder = Color(0xFFD9E8DC);

ThemeData buildBoksTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: boksBrand,
    brightness: Brightness.light,
  );
  return ThemeData(
    colorScheme: scheme.copyWith(
      primary: boksBrand,
      onPrimary: Colors.white,
      surface: Colors.white,
      onSurface: boksInk,
    ),
    scaffoldBackgroundColor: boksCanvas,
    useMaterial3: true,
    fontFamily: 'sans',
    appBarTheme: const AppBarTheme(
      backgroundColor: boksCanvas,
      foregroundColor: boksInk,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: boksBorder),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFFBFEFB),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: boksBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: boksBorder),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: boksBrand,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: boksBrand,
        minimumSize: const Size.fromHeight(48),
        side: const BorderSide(color: boksBrand),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );
}
